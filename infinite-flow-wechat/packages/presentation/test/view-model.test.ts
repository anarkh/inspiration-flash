import type { GameCommand } from '@infinite-flow/application';
import { reduceGameCommand } from '@infinite-flow/application';
import {
  DUNGEON_FEATURE_HELP_IDS,
  DUNGEON_ORDER,
  EQUIPMENT,
  createInitialState,
  getEquipmentCommissionStatus,
  getEquipmentMemoryStatus,
  getGameAsset,
  getRunLootSecurityStatus,
  getRunPursuitDefinition,
  listRouteContracts,
  type CombatAction,
  type DungeonId,
  type GameState,
  type ItemId
} from '@infinite-flow/core';
import {
  createEquipmentMemoryCombatState,
  createEquipmentMemoryHuntRunState,
  createEquipmentMemoryRunSnapshot,
  createPreparedEquipmentMemoryHunt,
  getEquipmentMemoryForDungeon,
  settleEquipmentMemoryHuntRun,
  transitionEquipmentMemoryHuntEventOutcome,
  transitionEquipmentMemoryHuntNodeClear,
  unlockEquipmentMemory
} from '@infinite-flow/core/equipment-memory-hunts';
import { createEquipmentRoll } from '@infinite-flow/core/equipment-rolls';
import { getEquipmentAttunementOptions } from '@infinite-flow/core/equipment-system';
import {
  COCOS_DESIGN_TOKENS,
  HUB_PANELS,
  buildGameViewModel,
  type EquipmentCommissionDraft,
  type GameViewModel,
  type ResultDetailViewModel,
  type ResultSettlementCard,
  type ViewActionModel
} from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert(Object.is(actual, expected), `${message}: expected ${String(expected)}, received ${String(actual)}`);
}

function getActions(viewModel: GameViewModel): readonly ViewActionModel[] {
  return viewModel.sections[2].actions;
}

function requireAction(viewModel: GameViewModel, actionId: string): ViewActionModel {
  const action = getActions(viewModel).find((candidate) => candidate.actionId === actionId);
  assert(action, `missing action ${actionId}`);
  return action;
}

function commandFrom(action: ViewActionModel): GameCommand {
  assert(action.enabled, `${action.actionId} must be enabled`);
  assert(action.event?.kind === 'command', `${action.actionId} must emit one command`);
  return action.event.command;
}

function committed(state: GameState, command: GameCommand, message: string): GameState {
  const result = reduceGameCommand(state, command);
  if (result.status === 'rejected') throw new Error(`${message}: ${result.reason.message}`);
  return result.state;
}

function verifyActionContract(viewModel: GameViewModel): void {
  const seen = new Set<string>();
  for (const action of getActions(viewModel)) {
    assert(!seen.has(action.actionId), `duplicate action ID ${action.actionId}`);
    seen.add(action.actionId);
    if (action.enabled) {
      assert(action.event !== undefined, `${action.actionId} enabled action must emit one event`);
      assert(action.event.kind === 'command' || action.event.kind === 'local', `${action.actionId} event must be discriminated`);
    } else {
      assert(action.event === undefined, `${action.actionId} disabled action must emit no event`);
      assert(Boolean(action.disabledReason), `${action.actionId} disabled action must explain why`);
    }
  }
}

function buildEnteredState(): GameState {
  const hub = createInitialState();
  const hubView = buildGameViewModel(hub, {});
  const confirm = requireAction(hubView, 'hub.entry.confirm');
  assert(confirm.event?.kind === 'local', 'entry confirmation must be a local host request');
  assert(confirm.event.action.type === 'entry/request-enter', 'entry confirmation must request entry');
  assert(!('seeds' in confirm.event.action), 'presentation must not embed seeds in entry request');
  assert(!('commandId' in confirm.event.action), 'presentation must not embed command IDs');
  const draft = confirm.event.action.draft;
  const enter: GameCommand = {
    type: 'run/enter',
    ...draft,
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 }
  };
  const result = reduceGameCommand(hub, enter);
  assert(result.status === 'committed', 'host-injected seed should enter chapter one');
  equal(result.state.phase, 'explore', 'entry must reach explore');
  return result.state;
}

function buildDefaultBloodRuneTrapState(): GameState {
  let state = buildEnteredState();
  equal(state.run?.dungeonId, 'demon_tower_1', 'default entry dungeon');
  equal(state.run?.currentNodeId, 'fog_lesser_demon', 'default entry node');
  equal(state.learnedMethods.length, 0, 'default save has no learned event method');
  equal(state.ownedPets.length, 0, 'default save has no event pet');
  equal(state.inventory.dispel_talisman ?? 0, 0, 'default save has no trap counter item');

  const openingView = buildGameViewModel(state, {});
  state = committed(
    state,
    commandFrom(requireAction(openingView, 'node.select:fog_lesser_demon')),
    'default opening combat must start'
  );

  let turns = 0;
  while (state.phase === 'combat') {
    assert(turns < 10, 'default opening combat must terminate');
    const combatView = buildGameViewModel(state, {});
    state = committed(
      state,
      commandFrom(requireAction(combatView, 'combat.action:attack')),
      'default opening attack must commit'
    );
    turns += 1;
  }
  assert(turns > 0, 'default opening combat must execute through presentation actions');
  equal(state.phase, 'explore', 'default opening combat returns to explore');
  assert(state.run?.clearedNodeIds.includes('fog_lesser_demon'), 'default opening node must be cleared');

  const clearedView = buildGameViewModel(state, {});
  const moveToTrap = getActions(clearedView).find((action) =>
    action.event?.kind === 'command'
      && action.event.command.type === 'run/move'
      && action.event.command.nodeId === 'blood_rune_trap'
  );
  assert(moveToTrap, 'default route must expose movement to blood rune stair');
  state = committed(state, commandFrom(moveToTrap), 'default route must reach blood rune stair');
  equal(state.run?.currentNodeId, 'blood_rune_trap', 'default route current node');
  assert(!state.run?.resolvedEventIds.includes('blood_rune_stair'), 'blood rune event must still be pending');
  return state;
}

function verifyHubAndHelp(): void {
  const hub = createInitialState();
  const viewModel = buildGameViewModel(hub, { activeHelpId: 'combatFlow' });
  verifyActionContract(viewModel);
  equal(viewModel.phase, 'hub', 'hub phase');
  equal(viewModel.visualAssetKey, 'scene:main_god_space', 'hub visual key is stable');
  assert(getGameAsset('scene', 'main_god_space')?.key === viewModel.visualAssetKey, 'hub visual key exists in core');
  equal(viewModel.sections.map((section) => section.kind).join(','), 'objective,status,actions,risks,help,logs', 'information order');
  equal(viewModel.sections[4].entries.length, 24, 'core plus presentation-local help count');
  equal(viewModel.sections[4].entries.length, DUNGEON_FEATURE_HELP_IDS.length + 1, 'commission help is added without replacing a core help ID');
  for (const helpId of DUNGEON_FEATURE_HELP_IDS) {
    assert(viewModel.sections[4].entries.some(({ id }) => id === helpId), `core help ${helpId} remains exposed`);
  }
  for (const help of viewModel.sections[4].entries) {
    assert(help.title.length > 0, `${help.id} title`);
    assert(help.summary.length > 0, `${help.id} summary`);
    assert(help.mechanic.length > 0, `${help.id} mechanic`);
    assert(help.guidance.length > 0, `${help.id} guidance`);
    assert(help.readout.length > 0, `${help.id} readout`);
    assert(help.keywords.length > 0, `${help.id} keywords`);
  }
  assert(viewModel.sections[4].active?.id === 'combatFlow', 'active help overlay is complete');
  assert(viewModel.sections[4].active.closeAction.event.action.type === 'help/close', 'help overlay has local close action');
  const commissionHelpView = buildGameViewModel(hub, { activeHelpId: 'equipmentCommission' });
  const commissionHelp = commissionHelpView.sections[4].active;
  equal(commissionHelp?.id, 'equipmentCommission', 'presentation-local commission help opens through the shared overlay');
  const commissionHelpCopy = [
    commissionHelp?.summary,
    commissionHelp?.mechanic,
    commissionHelp?.guidance,
    commissionHelp?.readout
  ].join(' ');
  for (const requiredCopy of ['最高等级', '未装备', '300 奖励点', '1 灵蕴', '三个不同副本', '重复副本', '撤退', '失败', '不返还', '永久背包']) {
    assert(commissionHelpCopy.includes(requiredCopy), `commission help covers ${requiredCopy}`);
  }
  const commissionHelpEntry = viewModel.sections[4].entries.find(({ id }) => id === 'equipmentCommission');
  assert(commissionHelpEntry?.openAction.event.action.type === 'help/open', 'commission help uses the stable local open event');
  assert(commissionHelpEntry.openAction.event.action.type === 'help/open', 'commission help open payload is narrowed');
  equal(commissionHelpEntry.openAction.event.action.helpId, 'equipmentCommission', 'commission help open payload uses the local help ID');
  const memoryHelpView = buildGameViewModel(hub, { activeHelpId: 'equipmentMemory' });
  const memoryHelp = memoryHelpView.sections[4].active;
  equal(memoryHelp?.id, 'equipmentMemory', 'core equipmentMemory ID opens the presentation modern-semantics override');
  const memoryHelpCopy = [
    memoryHelp?.summary,
    memoryHelp?.mechanic,
    memoryHelp?.guidance,
    memoryHelp?.readout
  ].join(' ');
  for (const requiredCopy of ['已装备', '满级', '合法铭刻', '淬炼达到 II', '成功抵达出口', '自动收录并激活', '装备面板', '现代入场', 'legacy', '双信号']) {
    assert(memoryHelpCopy.includes(requiredCopy), `modern equipment-memory help covers ${requiredCopy}`);
  }
  assert(!memoryHelpCopy.includes('副本页只显示当前记忆任务'), 'modern help does not restore the obsolete hunt-first summary');
  const initialHp = viewModel.sections[1].metrics.find((metric) => metric.id === 'hp')?.value;
  hub.player.hp = 1;
  equal(viewModel.sections[1].metrics.find((metric) => metric.id === 'hp')?.value, initialHp, 'VM is detached from domain state');
  assert(Object.isFrozen(viewModel), 'VM root must be frozen');
  assert(Object.isFrozen(viewModel.sections[1].detail), 'phase detail must be deeply frozen');
  JSON.parse(JSON.stringify(viewModel));
}

function buildRichHubState(): GameState {
  const base = createInitialState();
  const inventory = { ...base.inventory };
  for (const itemId of Object.keys(inventory) as Array<keyof typeof inventory>) {
    inventory[itemId] = 50;
  }
  return {
    ...base,
    rewardPoints: 50_000,
    lingyun: 500,
    inventory,
    completedDungeonIds: [...DUNGEON_ORDER]
  };
}

function assertEnabledCommand(
  state: GameState,
  viewModel: GameViewModel,
  actionId: string,
  commandType: GameCommand['type']
): GameState {
  const action = requireAction(viewModel, actionId);
  const command = commandFrom(action);
  equal(command.type, commandType, `${actionId} command type`);
  const result = reduceGameCommand(state, command);
  assert(result.status === 'committed', `${actionId} must commit through the real reducer`);
  return result.state;
}

function verifyEquipmentChapterRecipeSemantics(): void {
  const initial = createInitialState();
  const lockedWithOrdinaryCurrency: GameState = {
    ...initial,
    rewardPoints: 1_000_000,
    inventory: {
      ...initial.inventory,
      demon_bone: 50,
      star_iron: 50
    }
  };
  const lockedView = buildGameViewModel(lockedWithOrdinaryCurrency, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  const locked = requireAction(lockedView, 'hub.equipment.buy:armor_piercing_sword');
  equal(locked.enabled, false, 'an uncompleted chapter recipe remains locked despite abundant ordinary currency');
  assert(locked.event === undefined, 'a locked recipe emits no fallback buy command');
  assert(locked.disabledReason?.includes('首次通关'), 'locked recipe explains its chapter clear prerequisite');
  assert(locked.readout?.includes('妖塔一层目录'), 'locked recipe names its first source chapter');
  assert(locked.readout?.includes('妖骨 x1'), 'locked recipe exposes the exact selector-derived material cost');

  const unlockedButPoor: GameState = {
    ...lockedWithOrdinaryCurrency,
    completedDungeonIds: ['demon_tower_1'],
    inventory: { ...lockedWithOrdinaryCurrency.inventory, demon_bone: 0 }
  };
  const poorView = buildGameViewModel(unlockedButPoor, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  const poor = requireAction(poorView, 'hub.equipment.buy:armor_piercing_sword');
  equal(poor.enabled, false, 'an unaffordable unlocked recipe is disabled');
  assert(poor.event === undefined, 'an unaffordable recipe emits no command');
  assert(poor.disabledReason?.includes('资源不足'), 'the reducer preflight rejection remains visible');
  assert(poor.disabledReason?.includes('妖骨 x1'), 'the unavailable reason preserves the exact recipe cost');
  assert(poor.readout?.includes('持有 0 · 缺口 1'), 'the recipe detail exposes held material and exact gap');

  const twoUnlockedNeitherPayable: GameState = {
    ...unlockedButPoor,
    completedDungeonIds: ['demon_tower_1', 'starfall_mine'],
    inventory: { ...unlockedButPoor.inventory, demon_bone: 0, star_iron: 0 }
  };
  const firstUnlockedFallback = requireAction(
    buildGameViewModel(twoUnlockedNeitherPayable, {
      hubPanel: 'equipment',
      hubSelections: { equipment: 'armor_piercing_sword' }
    }),
    'hub.equipment.buy:armor_piercing_sword'
  );
  equal(firstUnlockedFallback.enabled, false, 'two unaffordable unlocked recipes remain disabled');
  assert(firstUnlockedFallback.readout?.includes('妖塔一层目录'), 'when none is payable, detail selects the first unlocked source');
  assert(!firstUnlockedFallback.readout?.includes('星坠矿场目录'), 'the first-unlocked fallback is deterministic rather than merged');

  const secondSourcePayable: GameState = {
    ...lockedWithOrdinaryCurrency,
    completedDungeonIds: ['demon_tower_1', 'starfall_mine'],
    inventory: {
      ...lockedWithOrdinaryCurrency.inventory,
      demon_bone: 0,
      star_iron: 1
    }
  };
  const secondSourceView = buildGameViewModel(secondSourcePayable, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  const purchase = commandFrom(requireAction(secondSourceView, 'hub.equipment.buy:armor_piercing_sword'));
  assert(purchase.type === 'hub/buy-equipment', 'recipe selection emits equipment purchase');
  equal(purchase.sourceDungeonId, 'starfall_mine', 'payable source wins over the first unlocked but unaffordable source');
  const purchased = reduceGameCommand(secondSourcePayable, purchase);
  assert(purchased.status === 'committed', 'selected payable chapter recipe commits');
  equal(purchased.state.inventory.star_iron, 0, 'selected chapter material is consumed');
  equal(purchased.state.inventory.demon_bone, 0, 'another chapter material is not consumed');
  equal(purchased.state.rewardPoints, secondSourcePayable.rewardPoints, 'chapter exchange never falls back to ordinary reward-point price');

  const noRecipeState: GameState = {
    ...lockedWithOrdinaryCurrency,
    ownedEquipment: lockedWithOrdinaryCurrency.ownedEquipment.filter((id) => id !== 'training_blade')
  };
  const noRecipe = requireAction(
    buildGameViewModel(noRecipeState, {
      hubPanel: 'equipment',
      hubSelections: { equipment: 'training_blade' }
    }),
    'hub.equipment.buy:training_blade'
  );
  equal(noRecipe.enabled, false, 'equipment absent from every chapter recipe cannot use its ordinary catalog cost');
  assert(noRecipe.disabledReason?.includes('不能按普通奖励点价格回退购买'), 'no-recipe reason makes the no-fallback rule explicit');
  assert(noRecipe.event === undefined, 'no-recipe equipment emits no buy command');
}

function verifyEquipmentCommission(): void {
  const rich = buildRichHubState();
  const eligible: GameState = {
    ...rich,
    ownedEquipment: [
      ...rich.ownedEquipment,
      'armor_piercing_sword',
      'chronal_edge'
    ],
    equipmentLevels: {
      ...rich.equipmentLevels,
      armor_piercing_sword: EQUIPMENT.armor_piercing_sword.maxLevel,
      chronal_edge: EQUIPMENT.chronal_edge.maxLevel
    }
  };
  const selectorStatus = getEquipmentCommissionStatus(eligible);
  const armorCandidate = selectorStatus.candidates.find(
    ({ equipmentId }) => equipmentId === 'armor_piercing_sword'
  );
  const chronalCandidate = selectorStatus.candidates.find(
    ({ equipmentId }) => equipmentId === 'chronal_edge'
  );
  assert(armorCandidate && chronalCandidate, 'the core selector supplies both eligible commission candidates');
  equal(selectorStatus.cost.rewardPoints, 300, 'commission reward-point cost comes from core');
  equal(selectorStatus.cost.lingyun, 1, 'commission lingyun cost comes from core');

  const idleView = buildGameViewModel(eligible, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  verifyActionContract(idleView);
  assert(idleView.sections[1].detail.kind === 'hub', 'commission idle detail is nested in hub');
  const idle = idleView.sections[1].detail.equipmentCommission;
  assert(idle, 'equipment panel exposes structured commission detail');
  equal(idle.status, 'idle', 'zero selections produce idle status');
  equal(idle.draft.equipmentIds.length, 0, 'idle draft starts with zero equipment');
  equal(idle.draft.targetMaterialId, null, 'idle draft starts without target material');
  equal(idle.requiredEquipmentCount, 2, 'commission explicitly requires two equipment');
  equal(idle.requiredDungeonCount, selectorStatus.requiredDungeonCount, 'required distinct dungeon count comes from core');
  equal(idle.materialReward, selectorStatus.materialReward, 'material reward comes from core');
  assert(idle.candidates.some(({ equipmentId }) => equipmentId === armorCandidate.equipmentId), 'selector candidate is projected');
  assert(getActions(idleView).length < 20, 'idle commission panel remains below the 20-action ceiling');

  const selectArmor = requireAction(
    idleView,
    'hub.equipment.commission.toggle:armor_piercing_sword'
  );
  assert(selectArmor.event?.kind === 'local', 'commission candidate toggle emits one local event');
  equal(selectArmor.event.action.type, 'hub/set-equipment-commission-draft', 'commission uses the full-draft setter event');
  assert(selectArmor.event.action.type === 'hub/set-equipment-commission-draft', 'commission setter payload is narrowed');
  equal(selectArmor.event.action.draft.equipmentIds.join(','), 'armor_piercing_sword', 'first setter snapshot contains exactly one selected equipment');
  equal(selectArmor.event.action.draft.targetMaterialId, null, 'first setter snapshot has an explicit null material');
  const oneDraft = selectArmor.event.action.draft;

  const oneView = buildGameViewModel(eligible, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'chronal_edge' },
    equipmentCommissionDraft: oneDraft
  });
  assert(oneView.sections[1].detail.kind === 'hub', 'one-equipment draft remains in hub detail');
  equal(oneView.sections[1].detail.equipmentCommission?.status, 'draft', 'one selection produces draft status');
  const selectChronal = requireAction(oneView, 'hub.equipment.commission.toggle:chronal_edge');
  assert(selectChronal.event?.kind === 'local' && selectChronal.event.action.type === 'hub/set-equipment-commission-draft', 'second candidate uses the same complete setter');
  equal(selectChronal.event.action.draft.equipmentIds.join(','), 'armor_piercing_sword,chronal_edge', 'second setter snapshot preserves order and distinctness');
  const twoDraft = selectChronal.event.action.draft;

  const twoView = buildGameViewModel(eligible, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'chronal_edge' },
    equipmentCommissionDraft: twoDraft
  });
  assert(twoView.sections[1].detail.kind === 'hub', 'two-equipment draft remains in hub detail');
  equal(twoView.sections[1].detail.equipmentCommission?.draft.equipmentIds.length, 2, 'two distinct equipment survive normalization');
  const chooseMaterial = requireAction(twoView, 'hub.equipment.commission.material');
  assert(chooseMaterial.event?.kind === 'local' && chooseMaterial.event.action.type === 'hub/set-equipment-commission-draft', 'material selection replaces the complete draft locally');
  equal(chooseMaterial.event.action.draft.equipmentIds.join(','), 'armor_piercing_sword,chronal_edge', 'material setter preserves both selected equipment');
  equal(chooseMaterial.event.action.draft.targetMaterialId, armorCandidate.materialId, 'first selector-derived material is selected deterministically');
  const readyDraft = chooseMaterial.event.action.draft;

  const readyView = buildGameViewModel(eligible, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'chronal_edge' },
    equipmentCommissionDraft: readyDraft
  });
  verifyActionContract(readyView);
  assert(readyView.sections[1].detail.kind === 'hub', 'ready commission uses hub detail');
  const readyDetail = readyView.sections[1].detail.equipmentCommission;
  assert(readyDetail, 'ready commission detail exists');
  equal(readyDetail.status, 'draft', 'complete unsubmitted commission remains a draft');
  equal(readyDetail.start?.enabled, true, 'ready draft start state is enabled');
  equal(readyDetail.cost.find(({ resource }) => resource === 'rewardPoints')?.required, 300, 'detail exposes exact 300 reward-point cost');
  equal(readyDetail.cost.find(({ resource }) => resource === 'lingyun')?.required, 1, 'detail exposes exact one-lingyun cost');
  const start = commandFrom(requireAction(readyView, 'hub.equipment.commission.start'));
  equal(start.type, 'hub/start-equipment-commission', 'commission starts through the exact application command');
  assert(start.type === 'hub/start-equipment-commission', 'commission start payload is narrowed');
  equal(start.equipmentIds.join(','), 'armor_piercing_sword,chronal_edge', 'start payload carries the ordered distinct equipment pair');
  equal(start.targetMaterialId, armorCandidate.materialId, 'start payload carries the selector-derived target material');
  const started = committed(eligible, start, 'commission start must pass the real reducer');
  equal(started.rewardPoints, eligible.rewardPoints - 300, 'real reducer consumes exactly 300 reward points');
  equal(started.lingyun, eligible.lingyun - 1, 'real reducer consumes exactly one lingyun');
  assert(started.equipmentCommission, 'real reducer creates an active commission');

  const poor: GameState = { ...eligible, rewardPoints: 0, lingyun: 0 };
  const poorView = buildGameViewModel(poor, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' },
    equipmentCommissionDraft: readyDraft
  });
  const poorStart = requireAction(poorView, 'hub.equipment.commission.start');
  equal(poorStart.enabled, false, 'unaffordable commission is disabled by reducer preflight');
  assert(poorStart.event === undefined, 'unaffordable commission emits no command');
  assert(poorStart.disabledReason?.includes('300 奖励点') && poorStart.disabledReason.includes('1 灵蕴'), 'unaffordable reason preserves the real exact cost');
  assert(poorView.sections[1].detail.kind === 'hub', 'poor commission remains inspectable in hub');
  equal(poorView.sections[1].detail.equipmentCommission?.canAfford, false, 'structured detail exposes affordability');
  equal(poorView.sections[1].detail.equipmentCommission?.cost.find(({ resource }) => resource === 'rewardPoints')?.gap, 300, 'structured detail exposes reward-point gap');
  equal(poorView.sections[1].detail.equipmentCommission?.cost.find(({ resource }) => resource === 'lingyun')?.gap, 1, 'structured detail exposes lingyun gap');
  assert(getActions(poorView).length < 20, 'unaffordable draft stays below the action ceiling');

  const malformedDraft = {
    equipmentIds: ['armor_piercing_sword', 'armor_piercing_sword', 'training_blade'],
    targetMaterialId: 'healing_pill' as ItemId
  } as unknown as EquipmentCommissionDraft;
  const normalizedView = buildGameViewModel(eligible, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' },
    equipmentCommissionDraft: malformedDraft
  });
  assert(normalizedView.sections[1].detail.kind === 'hub', 'malformed local draft still produces hub detail');
  const normalized = normalizedView.sections[1].detail.equipmentCommission?.draft;
  assert(normalized, 'normalized commission draft exists');
  equal(normalized.equipmentIds.join(','), 'armor_piercing_sword', 'draft normalization removes duplicates and non-candidates');
  equal(normalized.targetMaterialId, null, 'draft normalization drops a target outside selected candidates');

  const activeWithProgress: GameState = {
    ...started,
    equipmentCommission: {
      ...started.equipmentCommission!,
      completedDungeonIds: ['demon_tower_1', 'metro_abyss']
    }
  };
  const activeView = buildGameViewModel(activeWithProgress, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' },
    equipmentCommissionDraft: readyDraft
  });
  verifyActionContract(activeView);
  assert(activeView.sections[1].detail.kind === 'hub', 'active commission remains in hub detail');
  const activeDetail = activeView.sections[1].detail.equipmentCommission;
  assert(activeDetail?.active, 'active commission projects structured progress');
  equal(activeDetail.status, 'active', 'active commission status is explicit');
  equal(activeDetail.draft.equipmentIds.length, 0, 'stale host draft is ignored while a commission is active');
  equal(activeDetail.active.completedCount, 2, 'active detail exposes completed distinct dungeons');
  equal(activeDetail.active.remainingCount, 1, 'active detail exposes remaining distinct dungeons');
  equal(activeDetail.active.completedDungeonNames.length, 2, 'active detail names every completed dungeon');
  assert(activeDetail.active.recallLossReadout.includes('不退款'), 'active detail warns that recall has no refund');
  const recallAction = requireAction(activeView, 'hub.equipment.commission.recall');
  equal(recallAction.emphasis, 'danger', 'recall uses danger emphasis');
  equal(recallAction.recommendation, 'high-risk', 'recall is explicitly high-risk');
  assert(recallAction.riskReason?.includes('不返还') && recallAction.riskReason.includes('2/3'), 'recall risk names no refund and lost progress');
  const recall = commandFrom(recallAction);
  equal(recall.type, 'hub/recall-equipment-commission', 'recall uses the exact application command');
  const recalled = committed(activeWithProgress, recall, 'commission recall must pass the real reducer');
  equal(recalled.equipmentCommission, undefined, 'recall clears the active commission');
  equal(recalled.rewardPoints, activeWithProgress.rewardPoints, 'recall does not refund reward points');
  equal(recalled.lingyun, activeWithProgress.lingyun, 'recall does not refund lingyun');
  assert(getActions(activeView).length < 20, 'active commission panel remains below the 20-action ceiling');
  JSON.parse(JSON.stringify(activeView));
  assert(Object.isFrozen(activeDetail.active.completedDungeonIds), 'commission detail remains deeply frozen');

  const entered = buildEnteredState();
  assert(entered.run, 'result commission fixture requires a run');
  const advancedResult: GameState = {
    ...entered,
    phase: 'result',
    combat: undefined,
    lastOutcome: 'outcome=completed',
    run: {
      ...entered.run,
      lastEquipmentCommissionSettlement: {
        status: 'advanced',
        dungeonId: 'demon_tower_1',
        equipmentIds: ['armor_piercing_sword', 'chronal_edge'],
        targetMaterialId: armorCandidate.materialId,
        completedDungeonIds: ['demon_tower_1'],
        rewardAmount: 0
      }
    }
  };
  const advancedView = buildGameViewModel(advancedResult, {});
  assert(advancedView.sections[1].detail.kind === 'result', 'advanced commission settlement is projected on result');
  const advanced = advancedView.sections[1].detail.equipmentCommissionSettlement;
  assert(advanced, 'advanced settlement detail exists');
  equal(advanced.status, 'advanced', 'advanced settlement status is preserved');
  equal(advanced.completedCount, 1, 'advanced settlement exposes distinct completion count');
  equal(advanced.remainingCount, 2, 'advanced settlement exposes remaining count');
  equal(advanced.rewardAmount, 0, 'advanced settlement does not invent a material reward');

  const completedResult: GameState = {
    ...advancedResult,
    run: {
      ...advancedResult.run!,
      lastEquipmentCommissionSettlement: {
        ...advancedResult.run!.lastEquipmentCommissionSettlement!,
        status: 'completed',
        completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'rust_hospital'],
        rewardAmount: 2
      }
    }
  };
  const completedView = buildGameViewModel(completedResult, {});
  assert(completedView.sections[1].detail.kind === 'result', 'completed commission settlement is projected on result');
  const completed = completedView.sections[1].detail.equipmentCommissionSettlement;
  assert(completed, 'completed settlement detail exists');
  equal(completed.status, 'completed', 'completed settlement status is preserved');
  equal(completed.remainingCount, 0, 'completed settlement has no remaining dungeons');
  equal(completed.rewardAmount, 2, 'completed settlement exposes material x2');
  assert(completed.rewardReadout.includes('x2') && completed.rewardReadout.includes('永久背包'), 'completion states that material x2 entered the permanent bag');
  JSON.parse(JSON.stringify(completedView));
  assert(Object.isFrozen(completed), 'commission result detail is deeply frozen');
}

function verifyEquipmentMemoryProjection(): void {
  const demonMemory = getEquipmentMemoryForDungeon('demon_tower_1');
  const metroMemory = getEquipmentMemoryForDungeon('metro_abyss');
  assert(demonMemory && metroMemory, 'equipment-memory fixtures require chapter definitions');
  const rich = buildRichHubState();
  const oneMemoryMap = unlockEquipmentMemory(
    {},
    'armor_piercing_sword',
    demonMemory.id
  );
  const twoMemoryMap = unlockEquipmentMemory(
    oneMemoryMap,
    'armor_piercing_sword',
    metroMemory.id
  );
  const libraryState: GameState = {
    ...rich,
    ownedEquipment: [...rich.ownedEquipment, 'armor_piercing_sword'],
    equipmentLevels: {
      ...rich.equipmentLevels,
      armor_piercing_sword: EQUIPMENT.armor_piercing_sword.maxLevel
    },
    equipped: { ...rich.equipped, weapon: 'armor_piercing_sword' },
    equipmentMemories: twoMemoryMap
  };
  const libraryView = buildGameViewModel(libraryState, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  verifyActionContract(libraryView);
  assert(libraryView.sections[1].detail.kind === 'hub', 'memory library is projected in hub detail');
  const library = libraryView.sections[1].detail.equipmentMemory;
  assert(library, 'focused equipment exposes a memory library detail');
  equal(library.helpId, 'equipmentMemory', 'memory library points at nearby modern help');
  equal(library.supported, true, 'focused equipment support is selector-derived');
  equal(library.owned, true, 'focused equipment ownership is selector-derived');
  equal(library.equipped, true, 'focused equipment equipped state is selector-derived');
  equal(library.unlocked, true, 'focused equipment unlocked state is explicit');
  equal(library.active, true, 'focused equipment active state is explicit');
  equal(library.unlockedCount, 2, 'focused equipment projects its unlocked memory count');
  equal(library.activeMemory?.memoryId, metroMemory.id, 'focused equipment projects its current active memory');
  equal(library.cycle.nextMemoryId, demonMemory.id, 'single cycle slot wraps to the next unlocked memory');
  const cycle = commandFrom(requireAction(libraryView, 'hub.equipment.memory.cycle'));
  equal(cycle.type, 'hub/activate-equipment-memory', 'memory cycle uses the exact application command');
  assert(cycle.type === 'hub/activate-equipment-memory', 'memory activation payload is narrowed');
  equal(cycle.equipmentId, 'armor_piercing_sword', 'memory activation carries focused equipment');
  equal(cycle.memoryId, demonMemory.id, 'memory activation carries the next unlocked memory');
  const cycled = committed(libraryState, cycle, 'memory activation must pass the real reducer');
  equal(getEquipmentMemoryStatus(cycled, 'armor_piercing_sword').activeMemory?.id, demonMemory.id, 'real reducer changes only the active memory');
  equal(
    getActions(libraryView).filter(({ actionId }) => actionId === 'hub.equipment.memory.cycle').length,
    1,
    'memory library never flattens unlocked memories into multiple action slots'
  );

  const uniqueView = buildGameViewModel({ ...libraryState, equipmentMemories: oneMemoryMap }, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  const uniqueCycle = requireAction(uniqueView, 'hub.equipment.memory.cycle');
  equal(uniqueCycle.enabled, false, 'the only unlocked and already active memory disables the cycle slot');
  assert(uniqueCycle.disabledReason?.includes('只收录并已激活'), 'unique active memory explains why cycling is unavailable');
  assert(uniqueCycle.event === undefined, 'disabled unique memory emits no command');

  const noUnlockState: GameState = { ...libraryState, equipmentMemories: {} };
  const noUnlockView = buildGameViewModel(noUnlockState, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  const noUnlock = requireAction(noUnlockView, 'hub.equipment.memory.cycle');
  equal(noUnlock.enabled, false, 'equipment without unlocked memories disables the one memory slot');
  assert(noUnlock.disabledReason?.includes('尚未收录任何记忆'), 'no-unlock reason points to modern collection help');
  assert(noUnlockView.sections[1].detail.kind === 'hub', 'no-unlock memory state remains inspectable');
  equal(noUnlockView.sections[1].detail.equipmentMemory?.unlocked, false, 'no-unlock state is explicit');
  equal(noUnlockView.sections[1].detail.equipmentMemory?.active, false, 'no-active state is explicit');
  assert(noUnlockView.sections[1].detail.equipmentMemory?.acquisitionReadout.includes('现代流程不预选记忆狩猎'), 'empty library states the modern no-hunt boundary');

  const unsupportedView = buildGameViewModel(rich, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'training_blade' }
  });
  assert(unsupportedView.sections[1].detail.kind === 'hub', 'unsupported equipment remains inspectable');
  equal(unsupportedView.sections[1].detail.equipmentMemory?.supported, false, 'unsupported selector state is explicit');
  equal(requireAction(unsupportedView, 'hub.equipment.memory.cycle').enabled, false, 'unsupported equipment disables the stable memory slot');

  const commissionReadyState: GameState = {
    ...rich,
    ownedEquipment: [...rich.ownedEquipment, 'armor_piercing_sword', 'chronal_edge'],
    equipmentLevels: {
      ...rich.equipmentLevels,
      armor_piercing_sword: EQUIPMENT.armor_piercing_sword.maxLevel,
      chronal_edge: EQUIPMENT.chronal_edge.maxLevel
    },
    equipmentMemories: twoMemoryMap
  };
  const commissionCandidate = getEquipmentCommissionStatus(commissionReadyState).candidates.find(
    ({ equipmentId }) => equipmentId === 'armor_piercing_sword'
  );
  assert(commissionCandidate, 'commission coexistence fixture requires the focused candidate');
  const maximalEquipmentView = buildGameViewModel(commissionReadyState, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' },
    equipmentCommissionDraft: {
      equipmentIds: ['armor_piercing_sword', 'chronal_edge'],
      targetMaterialId: commissionCandidate.materialId
    }
  });
  verifyActionContract(maximalEquipmentView);
  assert(getActions(maximalEquipmentView).length < 20, 'commission plus memory activation remains strictly below 20 actions');
  equal(getActions(maximalEquipmentView).filter(({ actionId }) => actionId === 'hub.equipment.memory.cycle').length, 1, 'maximal equipment panel still has one memory action slot');
  for (const action of getActions(maximalEquipmentView)) {
    if (action.event?.kind !== 'command') continue;
    assert(action.event.command.type !== 'hub/prepare-equipment-memory-hunt', 'modern presentation never exposes legacy memory-hunt preparation');
  }
  JSON.parse(JSON.stringify(maximalEquipmentView));
  assert(Object.isFrozen(library.unlockedMemories), 'memory library options are deeply frozen');

  const modernExplore = buildEnteredState();
  assert(modernExplore.run, 'equipment-memory run fixtures require an entered run');
  const modernExploreView = buildGameViewModel(modernExplore, {});
  assert(modernExploreView.sections[1].detail.kind === 'explore', 'modern entry reaches explore detail');
  equal(modernExplore.run.entryFlowVersion, 2, 'presentation host entry fixture uses modern flowVersion 2');
  equal(modernExplore.run.equipmentMemoryHunt, undefined, 'modern entry creates no memory hunt');
  equal(modernExploreView.sections[1].detail.equipmentMemoryHunt, undefined, 'modern explore does not fabricate a legacy hunt card');
  assert(!getActions(modernExploreView).some((action) =>
    action.event?.kind === 'command' && action.event.command.type === 'hub/prepare-equipment-memory-hunt'
  ), 'modern explore exposes no legacy preparation command');

  const prepared = createPreparedEquipmentMemoryHunt(
    'demon_tower_1',
    'armor_piercing_sword',
    demonMemory.id
  );
  const attunement = getEquipmentAttunementOptions('armor_piercing_sword')[0];
  assert(prepared && attunement, 'legacy hunt fixture requires a valid prepared pair and attunement');
  const hunt = createEquipmentMemoryHuntRunState(prepared, attunement.id);
  assert(hunt, 'legacy hunt fixture must create through core');
  const { entryFlowVersion: _entryFlowVersion, ...legacyRunBase } = modernExplore.run;
  const legacyExplore: GameState = {
    ...modernExplore,
    run: { ...legacyRunBase, equipmentMemoryHunt: hunt }
  };
  const legacyExploreView = buildGameViewModel(legacyExplore, {});
  assert(legacyExploreView.sections[1].detail.kind === 'explore', 'valid legacy hunt remains in explore detail');
  const legacyHunt = legacyExploreView.sections[1].detail.equipmentMemoryHunt;
  assert(legacyHunt, 'valid legacy hunt projects its dual-signal card');
  equal(legacyHunt.compatibility, 'current-legacy-hunt', 'snapshot-backed legacy hunt is distinguished from imported missing-snapshot state');
  equal(legacyHunt.signals.length, 2, 'legacy hunt projects exactly the node and event signals');
  equal(legacyHunt.signals[0]?.targetId, hunt.nodeId, 'node signal preserves exact target ID');
  equal(legacyHunt.signals[1]?.targetId, hunt.eventId, 'event signal preserves exact event ID');
  assert(legacyHunt.signals[1]?.targetName.includes(hunt.eventId), 'unexported event catalog falls back honestly to the event ID');
  equal(legacyHunt.frozenAttunement?.attunementId, attunement.id, 'legacy hunt projects its frozen attunement');
  equal(legacyHunt.nextTarget.kind, 'node', 'fresh legacy hunt points at its node signal');

  const nodeClearedHunt = transitionEquipmentMemoryHuntNodeClear(hunt, hunt.nodeId);
  assert(nodeClearedHunt, 'core advances the legacy node signal');
  const nodeClearedView = buildGameViewModel({
    ...legacyExplore,
    run: { ...legacyExplore.run!, equipmentMemoryHunt: nodeClearedHunt }
  }, {});
  assert(nodeClearedView.sections[1].detail.kind === 'explore', 'node-cleared hunt remains in explore');
  equal(nodeClearedView.sections[1].detail.equipmentMemoryHunt?.nextTarget.kind, 'event', 'after the node signal, next target is the exact event');

  const securedHunt = transitionEquipmentMemoryHuntEventOutcome(
    nodeClearedHunt,
    hunt.eventId,
    { success: true }
  );
  assert(securedHunt, 'core secures the legacy dual signal');
  const securedView = buildGameViewModel({
    ...legacyExplore,
    run: { ...legacyExplore.run!, equipmentMemoryHunt: securedHunt }
  }, {});
  assert(securedView.sections[1].detail.kind === 'explore', 'secured hunt remains in explore');
  equal(securedView.sections[1].detail.equipmentMemoryHunt?.nextTarget.kind, 'exit', 'secured hunt points honestly to exit settlement');

  const failedHunt = transitionEquipmentMemoryHuntEventOutcome(
    hunt,
    hunt.eventId,
    { success: false }
  );
  assert(failedHunt, 'core records a legacy event failure');
  const failedView = buildGameViewModel({
    ...legacyExplore,
    run: { ...legacyExplore.run!, equipmentMemoryHunt: failedHunt }
  }, {});
  assert(failedView.sections[1].detail.kind === 'explore', 'failed hunt remains in explore');
  equal(failedView.sections[1].detail.equipmentMemoryHunt?.failureReason, 'event_failure', 'failed hunt preserves the core reason code');
  assert(failedView.sections[1].detail.equipmentMemoryHunt?.display.detail.includes('目标事件失败'), 'failed hunt preserves core display detail');

  const { equipmentMemorySnapshot: _equipmentMemorySnapshot, ...importedRun } = legacyExplore.run!;
  const importedLegacyView = buildGameViewModel({
    ...legacyExplore,
    run: importedRun
  }, {});
  assert(importedLegacyView.sections[1].detail.kind === 'explore', 'imported legacy hunt remains inspectable');
  equal(importedLegacyView.sections[1].detail.equipmentMemoryHunt?.compatibility, 'imported-legacy-hunt', 'missing snapshot is explicitly identified as imported legacy');
  equal(importedLegacyView.sections[1].detail.equipmentMemoryHunt?.signals.length, 2, 'imported legacy hunt keeps both original signals');

  const malformedExplore = buildGameViewModel({
    ...modernExplore,
    run: {
      ...modernExplore.run,
      equipmentMemoryHunt: { status: 'secured' } as unknown as NonNullable<GameState['run']>['equipmentMemoryHunt']
    }
  }, {});
  assert(malformedExplore.sections[1].detail.kind === 'explore', 'malformed hunt produces inspectable fail-closed detail');
  equal(malformedExplore.sections[1].detail.equipmentMemoryHunt?.compatibility, 'malformed', 'malformed hunt is explicitly classified');
  equal(malformedExplore.sections[1].detail.equipmentMemoryHunt?.enabled, false, 'malformed hunt cannot appear executable');
  equal(malformedExplore.sections[1].detail.equipmentMemoryHunt?.signals.length, 0, 'malformed hunt invents no target signals');

  const startCombat = commandFrom(requireAction(
    modernExploreView,
    'node.select:fog_lesser_demon'
  ));
  const combatBase = committed(modernExplore, startCombat, 'memory combat fixture must start normally');
  assert(combatBase.run && combatBase.combat, 'memory combat fixture requires run and combat');
  const memorySnapshot = createEquipmentMemoryRunSnapshot(
    ['armor_piercing_sword'],
    oneMemoryMap
  );
  assert(memorySnapshot, 'memory combat fixture requires a valid entry snapshot');
  const memoryCombatState = createEquipmentMemoryCombatState(memorySnapshot, 'demon_tower_1');
  assert(memoryCombatState, 'matching snapshot creates the core combat memory state');
  const memoryCombat: GameState = {
    ...combatBase,
    run: { ...combatBase.run, equipmentMemorySnapshot: memorySnapshot },
    combat: { ...combatBase.combat, equipmentMemoryState: memoryCombatState }
  };
  const memoryCombatView = buildGameViewModel(memoryCombat, {});
  assert(memoryCombatView.sections[1].detail.kind === 'combat', 'matching memory projects in combat detail');
  const combatMemory = memoryCombatView.sections[1].detail.equipmentMemory;
  assert(combatMemory, 'matching combat exposes memory effect status');
  equal(combatMemory.status, 'active', 'valid snapshot-backed combat memory is active');
  equal(combatMemory.enabled, true, 'valid memory combat effect is enabled');
  equal(combatMemory.activeName, demonMemory.name, 'combat memory uses selector active name');
  equal(combatMemory.matchingEquipmentIds.join(','), 'armor_piercing_sword', 'combat memory names matching frozen equipment');
  equal(combatMemory.overflowState, 'empty', 'fresh combat memory has no stored overflow');

  const storedView = buildGameViewModel({
    ...memoryCombat,
    combat: {
      ...memoryCombat.combat!,
      equipmentMemoryState: { ...memoryCombatState, overflowFocus: 1, restored: false }
    }
  }, {});
  assert(storedView.sections[1].detail.kind === 'combat', 'stored memory remains in combat');
  equal(storedView.sections[1].detail.equipmentMemory?.overflowState, 'stored', 'overflow storage state is projected');
  const restoredView = buildGameViewModel({
    ...memoryCombat,
    combat: {
      ...memoryCombat.combat!,
      equipmentMemoryState: { ...memoryCombatState, overflowFocus: 0, restored: true }
    }
  }, {});
  assert(restoredView.sections[1].detail.kind === 'combat', 'restored memory remains in combat');
  equal(restoredView.sections[1].detail.equipmentMemory?.overflowState, 'restored', 'focus restoration state is projected');

  const { equipmentMemorySnapshot: _combatSnapshot, ...legacyCombatRun } = memoryCombat.run!;
  const legacyCombatView = buildGameViewModel({ ...memoryCombat, run: legacyCombatRun }, {});
  assert(legacyCombatView.sections[1].detail.kind === 'combat', 'legacy combat remains inspectable');
  const disabledLegacyCombat = legacyCombatView.sections[1].detail.equipmentMemory;
  assert(disabledLegacyCombat, 'legacy missing-snapshot combat emits fail-closed detail');
  equal(disabledLegacyCombat.status, 'legacy-disabled', 'legacy missing snapshot is classified');
  equal(disabledLegacyCombat.enabled, false, 'legacy missing snapshot cannot enable the effect');
  equal(disabledLegacyCombat.matchingEquipmentIds.length, 0, 'fail-closed legacy combat exposes no matching effect sources');
  assert(disabledLegacyCombat.disabledReason?.includes('fail-closed'), 'legacy combat explains fail-closed behavior');

  const malformedCombatView = buildGameViewModel({
    ...memoryCombat,
    combat: {
      ...memoryCombat.combat!,
      equipmentMemoryState: { rulesVersion: 999 } as unknown as NonNullable<GameState['combat']>['equipmentMemoryState']
    }
  }, {});
  assert(malformedCombatView.sections[1].detail.kind === 'combat', 'malformed combat memory remains inspectable');
  equal(malformedCombatView.sections[1].detail.equipmentMemory?.status, 'malformed-disabled', 'malformed combat memory is classified');
  equal(malformedCombatView.sections[1].detail.equipmentMemory?.enabled, false, 'malformed combat memory is fail-closed');
  JSON.parse(JSON.stringify(malformedCombatView));
  assert(Object.isFrozen(combatMemory.matchingEquipmentIds), 'combat memory detail is deeply frozen');

  const grantedSettlement = settleEquipmentMemoryHuntRun(securedHunt, 'successful_exit');
  assert(grantedSettlement.state, 'secured legacy hunt produces a settlement state');
  const legacyResult: GameState = {
    ...legacyExplore,
    phase: 'result',
    combat: undefined,
    run: {
      ...legacyRunBase,
      equipmentMemoryHunt: grantedSettlement.state,
      lastEquipmentMemoryHuntSettlement: grantedSettlement
    }
  };
  const legacyResultView = buildGameViewModel(legacyResult, {});
  assert(legacyResultView.sections[1].detail.kind === 'result', 'legacy settlement projects on result');
  const granted = legacyResultView.sections[1].detail.equipmentMemory?.legacyHunt;
  assert(granted, 'legacy result includes normalized hunt settlement');
  equal(granted.granted, true, 'legacy settlement preserves exact granted flag');
  equal(granted.status, 'banked', 'legacy settlement preserves exact banked status');
  equal(granted.reason, undefined, 'granted settlement invents no failure reason');
  assert(granted.rewardReadout.includes('额外奖励点、灵蕴与物品均为 0'), 'legacy grant does not invent side rewards');

  const failedSettlement = settleEquipmentMemoryHuntRun(failedHunt, 'successful_exit');
  assert(failedSettlement.state, 'failed legacy hunt produces a settlement state');
  const failedResultView = buildGameViewModel({
    ...legacyResult,
    run: {
      ...legacyResult.run!,
      equipmentMemoryHunt: failedSettlement.state,
      lastEquipmentMemoryHuntSettlement: failedSettlement
    }
  }, {});
  assert(failedResultView.sections[1].detail.kind === 'result', 'failed legacy settlement projects on result');
  const failedSettlementDetail = failedResultView.sections[1].detail.equipmentMemory?.legacyHunt;
  assert(failedSettlementDetail, 'failed legacy settlement detail exists');
  equal(failedSettlementDetail.granted, false, 'failed settlement preserves granted=false');
  equal(failedSettlementDetail.status, 'failed', 'failed settlement preserves exact status');
  equal(failedSettlementDetail.reason, 'event_failure', 'failed settlement preserves exact reason');

  const modernResult: GameState = {
    ...modernExplore,
    phase: 'result',
    combat: undefined,
    ownedEquipment: [...modernExplore.ownedEquipment, 'armor_piercing_sword'],
    equipmentMemories: oneMemoryMap,
    run: { ...modernExplore.run }
  };
  const modernResultView = buildGameViewModel(modernResult, {});
  assert(modernResultView.sections[1].detail.kind === 'result', 'modern memory library status projects on result');
  const modernLibrary = modernResultView.sections[1].detail.equipmentMemory?.modernLibrary;
  assert(modernLibrary, 'modern result includes current chapter memory library status');
  equal(modernLibrary.memoryId, demonMemory.id, 'modern result uses only the current chapter memory');
  equal(modernLibrary.status, 'active', 'modern result reports current library activation state');
  assert(modernLibrary.readout.includes('本章记忆') && modernLibrary.readout.includes('已收录') && modernLibrary.readout.includes('激活'), 'modern result uses honest collected/active wording');
  for (const forbiddenClaim of ['本次新获得', '刚刚获得', '本次解锁']) {
    assert(!modernLibrary.readout.includes(forbiddenClaim), `modern result does not claim ${forbiddenClaim}`);
  }
  const unrecordedModernView = buildGameViewModel({ ...modernResult, equipmentMemories: {} }, {});
  assert(unrecordedModernView.sections[1].detail.kind === 'result', 'unrecorded modern result remains inspectable');
  const unrecorded = unrecordedModernView.sections[1].detail.equipmentMemory?.modernLibrary;
  equal(unrecorded?.status, 'not-recorded', 'modern result is honest when current library lacks the chapter memory');
  assert(unrecorded?.readout.includes('尚未收录'), 'modern result does not imply an unlock without a core marker');
  JSON.parse(JSON.stringify(modernResultView));
  assert(Object.isFrozen(modernLibrary), 'modern result memory detail is deeply frozen');
}

function verifyEntryBuildSelection(): void {
  const initial = createInitialState();
  const initialView = buildGameViewModel(initial, {});
  assert(initialView.sections[1].detail.kind === 'hub', 'initial entry build uses hub detail');
  const initialBuild = initialView.sections[1].detail.entryBuild;
  equal(initialBuild.routeContract.options.length, 4, 'entry detail lists no contract plus all three current-dungeon contracts');
  equal(initialBuild.routeContract.options[0]?.routeContractId, null, 'the first route option is the explicit no-contract choice');
  assert(initialBuild.routeContract.options.slice(1).every((option) => option.orderedTargets.length === 2), 'each route contract exposes two ordered targets');
  assert(initialBuild.routeContract.options.slice(1).every((option) => option.rewardPoints > 0), 'each route contract exposes its independent reward');
  assert(initialBuild.routeContract.options.slice(1).every((option) => !option.selectable && option.disabledReason?.includes('首次通关')), 'first-clear lock is explicit on every contract option');
  const lockedRouteCycle = requireAction(initialView, 'hub.entry.route-contract:next');
  equal(lockedRouteCycle.enabled, false, 'route selection is disabled before the current dungeon first clear');
  assert(lockedRouteCycle.event === undefined, 'locked route selection emits no event');

  const rich = buildRichHubState();
  const routeView = buildGameViewModel(rich, {});
  assert(routeView.sections[1].detail.kind === 'hub', 'unlocked route entry uses hub detail');
  const expectedContracts = listRouteContracts('demon_tower_1');
  const routeCycle = requireAction(routeView, 'hub.entry.route-contract:next');
  assert(routeCycle.event?.kind === 'local', 'route selection emits one local event');
  equal(routeCycle.event.action.type, 'entry/select-route-contract', 'route selection local event type is stable');
  assert(routeCycle.event.action.type === 'entry/select-route-contract', 'route selection payload narrowed');
  equal(routeCycle.event.action.routeContractId, expectedContracts[0]?.id ?? null, 'route cycle selects the first current-dungeon contract');
  assert(routeCycle.readout?.includes('目标 1'), 'route action readout exposes target order');
  assert(routeCycle.readout?.includes(`${expectedContracts[0]!.rewardPoints} 奖励点`), 'route action readout exposes exact reward');

  const selectedId = expectedContracts[0]!.id;
  const selectedView = buildGameViewModel(rich, {
    entryDraft: { dungeonId: 'demon_tower_1', protocolId: 'standard', routeContractId: selectedId }
  });
  assert(selectedView.sections[1].detail.kind === 'hub', 'selected route remains in hub detail');
  equal(selectedView.sections[1].detail.entryBuild.routeContract.selectedRouteContractId, selectedId, 'selected route ID is explicit in detail');
  equal(selectedView.sections[1].detail.entryBuild.routeContract.selectionValid, true, 'same-dungeon route selection is valid');
  const confirm = requireAction(selectedView, 'hub.entry.confirm');
  assert(confirm.event?.kind === 'local' && confirm.event.action.type === 'entry/request-enter', 'selected route retains the unique host entry request');
  equal(confirm.event.action.draft.routeContractId, selectedId, 'host entry request carries the selected route contract');

  const wrongDungeonContractId = listRouteContracts('metro_abyss')[0]!.id;
  const wrongView = buildGameViewModel(rich, {
    entryDraft: {
      dungeonId: 'demon_tower_1',
      protocolId: 'standard',
      routeContractId: wrongDungeonContractId
    }
  });
  assert(wrongView.sections[1].detail.kind === 'hub', 'wrong-dungeon route still produces inspectable hub detail');
  equal(wrongView.sections[1].detail.entryBuild.routeContract.selectionValid, false, 'wrong-dungeon route fails closed');
  assert(wrongView.sections[1].detail.entryBuild.routeContract.issue?.includes('不属于当前副本'), 'wrong-dungeon detail explains the mismatch');
  assert(wrongView.sections[1].detail.panelSummary.includes('契约异常'), 'wrong-dungeon route is not silently normalized in the panel summary');
  const wrongConfirm = requireAction(wrongView, 'hub.entry.confirm');
  equal(wrongConfirm.enabled, false, 'wrong-dungeon route cannot confirm entry');
  assert(wrongConfirm.event === undefined, 'wrong-dungeon route cannot produce an entry request');
  const repair = requireAction(wrongView, 'hub.entry.route-contract:next');
  assert(repair.event?.kind === 'local' && repair.event.action.type === 'entry/select-route-contract', 'invalid draft exposes one local repair event');
  equal(repair.event.action.routeContractId, null, 'invalid route draft repairs to explicit no-contract');

  const lastContractId = expectedContracts[expectedContracts.length - 1]!.id;
  const clearRoute = requireAction(buildGameViewModel(rich, {
    entryDraft: { dungeonId: 'demon_tower_1', protocolId: 'standard', routeContractId: lastContractId }
  }), 'hub.entry.route-contract:next');
  assert(clearRoute.event?.kind === 'local' && clearRoute.event.action.type === 'entry/select-route-contract', 'route clear emits the same stable local event');
  equal(clearRoute.event.action.routeContractId, null, 'route clear uses explicit JSON null');

  const relicState: GameState = {
    ...rich,
    archivedRelicIds: ['mist_edge', 'focus_prism', 'bone_shell'],
    preparedRelicFrame: 'assault',
    preparedRelicSeedId: undefined,
    equipped: { ...rich.equipped, weapon: 'armor_piercing_sword' },
    equipmentLevels: { ...rich.equipmentLevels, armor_piercing_sword: 2 }
  };
  const relicView = buildGameViewModel(relicState, {});
  assert(relicView.sections[1].detail.kind === 'hub', 'relic preparation uses hub detail');
  const relic = relicView.sections[1].detail.entryBuild.relic;
  equal(relic.candidateCount, 3, 'matching equipment conduit expands relic candidates from two to three');
  equal(relic.candidateReadout, '2 → 3', 'conduit expansion has an explicit readout');
  equal(relic.matchingConduitEquipmentIds.join(','), 'armor_piercing_sword', 'matching conduit source is selector-derived');
  equal(relic.seedOptions.map(({ seedRelicId }) => seedRelicId ?? 'none').join(','), 'none,mist_edge,focus_prism', 'only archived relics in the current frame are legal seed options');
  const selectSeed = requireAction(relicView, 'hub.entry.relic-seed:next');
  assert(selectSeed.event?.kind === 'local' && selectSeed.event.action.type === 'entry/select-relic-seed', 'relic seed selection emits one stable local event');
  equal(selectSeed.event.action.frame, 'assault', 'relic seed event always carries its frame');
  equal(selectSeed.event.action.seedRelicId, 'mist_edge', 'relic seed event carries a legal archived relic');

  const clearSeedState: GameState = { ...relicState, preparedRelicSeedId: 'focus_prism' };
  const clearSeed = requireAction(buildGameViewModel(clearSeedState, {}), 'hub.entry.relic-seed:next');
  assert(clearSeed.event?.kind === 'local' && clearSeed.event.action.type === 'entry/select-relic-seed', 'relic seed clear uses the same stable local event');
  equal(clearSeed.event.action.frame, 'assault', 'relic seed clear keeps the current frame');
  equal(clearSeed.event.action.seedRelicId, null, 'relic seed clear uses explicit JSON null');

  assert(getActions(relicView).length < 20, 'maximal entry build remains below the 20-action single-screen ceiling');
  const deepEntry = buildGameViewModel(relicState, {
    entryDraft: { dungeonId: 'demon_tower_1', protocolId: 'deep', infernoTier: 1 }
  });
  assert(getActions(deepEntry).length < 20, 'deep entry with tier controls remains below the 20-action single-screen ceiling');
  verifyActionContract(relicView);
  JSON.parse(JSON.stringify(relicView));
  assert(Object.isFrozen(relic.seedOptions), 'entry build choices remain deeply frozen');
}

function verifyHubPanelsAndGrowthCommands(): void {
  const initial = createInitialState();
  const entry = buildGameViewModel(initial, {});
  verifyActionContract(entry);
  assert(entry.sections[1].detail.kind === 'hub', 'entry hub detail');
  equal(entry.sections[1].detail.activePanel, 'entry', 'entry is the stable default hub panel');
  const forgedPanel = buildGameViewModel(initial, {
    hubPanel: 'bogus'
  } as unknown as Parameters<typeof buildGameViewModel>[1]);
  assert(forgedPanel.sections[1].detail.kind === 'hub', 'forged panel still produces hub detail');
  equal(forgedPanel.sections[1].detail.activePanel, 'entry', 'unknown runtime panel falls back to entry');
  equal(forgedPanel.sections[1].detail.activePanelLabel, '入场', 'unknown runtime panel preserves required labels');
  assert(!forgedPanel.screenTitle.includes('undefined'), 'unknown runtime panel cannot leak undefined into the VM');
  JSON.parse(JSON.stringify(forgedPanel));
  const forgedProtocol = buildGameViewModel(initial, {
    entryDraft: { dungeonId: 'demon_tower_1', protocolId: 'bogus' }
  } as unknown as Parameters<typeof buildGameViewModel>[1]);
  assert(forgedProtocol.sections[1].detail.kind === 'hub', 'forged protocol still produces hub detail');
  assert(forgedProtocol.sections[1].detail.panelSummary.includes('未知协议'), 'unknown runtime protocol stays explicit');
  equal(requireAction(forgedProtocol, 'hub.entry.confirm').enabled, false, 'unknown runtime protocol cannot enter');
  assert(!JSON.stringify(forgedProtocol).includes('undefined'), 'forged protocol VM remains serializable without undefined text');
  const openSupplies = requireAction(entry, 'hub.panel:supplies');
  assert(openSupplies.event?.kind === 'local', 'hub panel navigation is local');
  equal(openSupplies.event.action.type, 'hub/select-panel', 'hub panel navigation action type');
  assert(!getActions(entry).some((action) => action.event?.kind === 'command' && action.event.command.type === 'hub/buy-item'), 'entry panel does not leak supplies actions');

  const supplies = buildGameViewModel(initial, {
    hubPanel: 'supplies',
    hubSelections: { supplies: 'healing_pill' }
  });
  verifyActionContract(supplies);
  assert(supplies.sections[1].detail.kind === 'hub', 'supplies hub detail');
  equal(supplies.sections[1].detail.activePanel, 'supplies', 'supplies panel selection');
  assert(getActions(supplies).length < 20, 'hub panel navigation plus focused operations remains compact');
  assert(getActions(supplies).some((action) => action.actionId === 'hub.panel:entry'), 'every non-entry panel can return to entry');
  assertEnabledCommand(initial, supplies, 'hub.supplies.buy:healing_pill', 'hub/buy-item');
  const toggle = commandFrom(requireAction(supplies, 'hub.supplies.toggle:healing_pill'));
  equal(toggle.type, 'hub/configure-tactical-loadout', 'supply toggle command type');
  assert(toggle.type === 'hub/configure-tactical-loadout', 'toggle payload narrowed');
  equal(toggle.itemIds.join(','), 'healing_pill', 'toggle adds one item without replacing unrelated current choices');
  const preset = commandFrom(requireAction(supplies, 'hub.loadout.chapter-one'));
  assert(preset.type === 'hub/configure-tactical-loadout', 'chapter-one preset command type');
  equal(preset.itemIds.join(','), 'healing_pill,dispel_talisman,gate_sigil', 'verified first-chapter loadout shortcut remains stable');

  const carriedState: GameState = {
    ...initial,
    preparedItemIds: ['healing_pill', 'gate_sigil']
  };
  const carriedView = buildGameViewModel(carriedState, {
    hubPanel: 'supplies',
    hubSelections: { supplies: 'dispel_talisman' }
  });
  const addThird = commandFrom(requireAction(carriedView, 'hub.supplies.toggle:dispel_talisman'));
  assert(addThird.type === 'hub/configure-tactical-loadout', 'add-third toggle command type');
  equal(addThird.itemIds.join(','), 'healing_pill,gate_sigil,dispel_talisman', 'toggle preserves every existing tactical selection');

  const rich = buildRichHubState();
  for (const hubPanel of HUB_PANELS) {
    const panelView = buildGameViewModel(rich, { hubPanel });
    verifyActionContract(panelView);
    assert(panelView.sections[1].detail.kind === 'hub', `${hubPanel} has hub detail`);
    equal(panelView.sections[1].detail.entryBuild.routeContract.options.length, 4, `${hubPanel} retains complete entry-build detail`);
    assert(getActions(panelView).length < 20, `${hubPanel} panel remains below the compact 20-action ceiling`);
  }
  const equipmentBuyView = buildGameViewModel(rich, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  const richEquipmentPurchase = commandFrom(requireAction(equipmentBuyView, 'hub.equipment.buy:armor_piercing_sword'));
  assert(richEquipmentPurchase.type === 'hub/buy-equipment', 'rich equipment purchase command type');
  equal(richEquipmentPurchase.sourceDungeonId, 'demon_tower_1', 'when multiple sources are payable, the first unlocked source wins');
  const boughtEquipment = committed(rich, richEquipmentPurchase, 'rich equipment chapter recipe must commit');
  const equipmentOwnedView = buildGameViewModel(boughtEquipment, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  assertEnabledCommand(boughtEquipment, equipmentOwnedView, 'hub.equipment.equip:armor_piercing_sword', 'hub/equip-equipment');
  assertEnabledCommand(boughtEquipment, equipmentOwnedView, 'hub.equipment.upgrade:armor_piercing_sword', 'hub/upgrade-equipment');

  const poorEquipmentState: GameState = {
    ...initial,
    ownedEquipment: [...initial.ownedEquipment, 'armor_piercing_sword'],
    equipmentLevels: { ...initial.equipmentLevels, armor_piercing_sword: 1 },
    rewardPoints: 0
  };
  const poorUpgrade = requireAction(
    buildGameViewModel(poorEquipmentState, {
      hubPanel: 'equipment',
      hubSelections: { equipment: 'armor_piercing_sword' }
    }),
    'hub.equipment.upgrade:armor_piercing_sword'
  );
  equal(poorUpgrade.enabled, false, 'unaffordable equipment upgrade is disabled');
  assert(poorUpgrade.disabledReason?.includes('资源不足'), 'upgrade disabled reason preserves domain rejection');
  assert(poorUpgrade.disabledReason?.includes('220 奖励点'), 'disabled action keeps its exact price visible in Cocos');
  assert(poorUpgrade.readout?.includes('220 奖励点'), 'abundant pure preflight derives the exact upgrade price without copying rules');
  assert(poorUpgrade.event === undefined, 'unaffordable upgrade emits no event');

  const forgedEquipment: GameState = {
    ...rich,
    ownedEquipment: [...rich.ownedEquipment, 'armor_piercing_sword'],
    equipmentLevels: { ...rich.equipmentLevels, armor_piercing_sword: 3 }
  };
  const forgeView = buildGameViewModel(forgedEquipment, {
    hubPanel: 'equipment',
    hubSelections: { equipment: 'armor_piercing_sword' }
  });
  const attune = getActions(forgeView).find((action) => action.actionId.startsWith('hub.equipment.attune:armor_piercing_sword:') && action.enabled);
  assert(attune, 'max-level set equipment exposes an enabled real attunement branch');
  equal(commandFrom(attune).type, 'hub/attune-equipment', 'equipment attunement command type');
  assert(reduceGameCommand(forgedEquipment, commandFrom(attune)).status === 'committed', 'equipment attunement commits');
  assertEnabledCommand(forgedEquipment, forgeView, 'hub.equipment.temper:armor_piercing_sword', 'hub/temper-equipment');

  const petBuyView = buildGameViewModel(rich, { hubPanel: 'pets', hubSelections: { pets: 'contract_sprite' } });
  const boughtPet = assertEnabledCommand(rich, petBuyView, 'hub.pets.buy:contract_sprite', 'hub/buy-pet');
  const inactivePet: GameState = { ...boughtPet, activePet: undefined };
  const petGrowthView = buildGameViewModel(inactivePet, { hubPanel: 'pets', hubSelections: { pets: 'contract_sprite' } });
  assertEnabledCommand(inactivePet, petGrowthView, 'hub.pets.upgrade:contract_sprite', 'hub/upgrade-pet');
  assertEnabledCommand(inactivePet, petGrowthView, 'hub.pets.activate:contract_sprite', 'hub/activate-pet');

  const methodLearnView = buildGameViewModel(rich, { hubPanel: 'methods', hubSelections: { methods: 'mist_breathing' } });
  const learnedMethod = assertEnabledCommand(rich, methodLearnView, 'hub.methods.learn:mist_breathing', 'hub/learn-method');
  const inactiveMethod: GameState = { ...learnedMethod, activeMethod: undefined };
  const methodGrowthView = buildGameViewModel(inactiveMethod, { hubPanel: 'methods', hubSelections: { methods: 'mist_breathing' } });
  assertEnabledCommand(inactiveMethod, methodGrowthView, 'hub.methods.upgrade:mist_breathing', 'hub/upgrade-method');
  assertEnabledCommand(inactiveMethod, methodGrowthView, 'hub.methods.activate:mist_breathing', 'hub/activate-method');

  const bloodlineUnlockView = buildGameViewModel(rich, { hubPanel: 'bloodlines', hubSelections: { bloodlines: 'titan_marrow' } });
  const unlockedBloodline = assertEnabledCommand(rich, bloodlineUnlockView, 'hub.bloodlines.unlock:titan_marrow', 'hub/unlock-bloodline');
  const inactiveBloodline: GameState = { ...unlockedBloodline, activeBloodline: undefined };
  const bloodlineGrowthView = buildGameViewModel(inactiveBloodline, { hubPanel: 'bloodlines', hubSelections: { bloodlines: 'titan_marrow' } });
  assertEnabledCommand(inactiveBloodline, bloodlineGrowthView, 'hub.bloodlines.upgrade:titan_marrow', 'hub/upgrade-bloodline');
  assertEnabledCommand(inactiveBloodline, bloodlineGrowthView, 'hub.bloodlines.activate:titan_marrow', 'hub/activate-bloodline');

  const companionRecruitView = buildGameViewModel(rich, { hubPanel: 'companions', hubSelections: { companions: 'qin_che' } });
  const recruitedCompanion = assertEnabledCommand(rich, companionRecruitView, 'hub.companions.recruit:qin_che', 'hub/recruit-companion');
  const inactiveCompanion: GameState = { ...recruitedCompanion, activeCompanion: undefined };
  const companionGrowthView = buildGameViewModel(inactiveCompanion, { hubPanel: 'companions', hubSelections: { companions: 'qin_che' } });
  assertEnabledCommand(inactiveCompanion, companionGrowthView, 'hub.companions.upgrade:qin_che', 'hub/upgrade-companion');
  assertEnabledCommand(inactiveCompanion, companionGrowthView, 'hub.companions.activate:qin_che', 'hub/activate-companion');

  const lockedCompanion = requireAction(
    buildGameViewModel(initial, { hubPanel: 'companions', hubSelections: { companions: 'qin_che' } }),
    'hub.companions.recruit:qin_che'
  );
  equal(lockedCompanion.enabled, false, 'locked companion recruitment is disabled');
  assert(lockedCompanion.disabledReason?.includes('首次通关妖塔一层'), 'locked companion explains its real chapter prerequisite');
  assert(lockedCompanion.event === undefined, 'locked companion emits no event');

  const taskView = buildGameViewModel(rich, {
    hubPanel: 'tasks',
    hubSelections: { tasks: 'mainline_clear_demon_tower_1' }
  });
  assertEnabledCommand(rich, taskView, 'hub.tasks.claim:mainline_clear_demon_tower_1', 'hub/claim-task');
  const incompleteTask = requireAction(
    buildGameViewModel(initial, { hubPanel: 'tasks', hubSelections: { tasks: 'mainline_clear_demon_tower_1' } }),
    'hub.tasks.claim:mainline_clear_demon_tower_1'
  );
  equal(incompleteTask.enabled, false, 'incomplete task claim is disabled');
  assert(incompleteTask.disabledReason?.includes('尚未完成'), 'incomplete task preserves the core progress reason');

  const allPanelModels = [supplies, equipmentBuyView, petBuyView, methodLearnView, bloodlineUnlockView, companionRecruitView, taskView];
  for (const panelModel of allPanelModels) {
    for (const action of getActions(panelModel)) {
      if (action.event?.kind !== 'command') continue;
      assert(action.event.command.type !== 'game/new', 'hub UI does not expose game/new');
      assert(action.event.command.type !== 'hub/prepare-equipment-hunt', 'hub UI keeps hidden equipment hunt prep hidden');
      assert(action.event.command.type !== 'hub/prepare-equipment-memory-hunt', 'hub UI keeps hidden memory hunt prep hidden');
    }
  }
}

function verifyMapFiveStatesAndMovement(): void {
  const entered = buildEnteredState();
  assert(entered.run, 'entered run required');
  const state: GameState = {
    ...entered,
    phase: 'explore',
    combat: undefined,
    run: {
      ...entered.run,
      currentNodeId: 'cracked_portal',
      clearedNodeIds: ['sealed_cache'],
      discoveredNodeIds: ['watch_post_cache', 'cracked_portal', 'sealed_cache']
    }
  };
  const viewModel = buildGameViewModel(state, {});
  verifyActionContract(viewModel);
  assert(viewModel.sections[1].detail.kind === 'explore', 'explore detail');
  equal(viewModel.visualAssetKey, `dungeon:${state.run?.dungeonId}`, 'explore visual key follows the active dungeon');
  assert(getGameAsset('dungeon', state.run!.dungeonId)?.key === viewModel.visualAssetKey, 'explore visual key exists in core');
  const map = viewModel.sections[1].detail.map;
  const states = new Set(map.nodes.map((node) => node.state));
  for (const expected of ['current', 'adjacent', 'scouted', 'cleared', 'fogged'] as const) {
    assert(states.has(expected), `map must contain ${expected}`);
  }
  const legal = map.nodes.find((node) => node.isAdjacent && node.canMove);
  assert(legal?.moveActionId, 'at least one physical neighbour must be movable');
  const legalAction = requireAction(viewModel, legal.moveActionId);
  const legalCommand = commandFrom(legalAction);
  assert(legalCommand.type === 'run/move', 'legal neighbour emits run/move');
  const moved = reduceGameCommand(state, legalCommand);
  assert(moved.status === 'committed', 'legal adjacent move commits');
  equal(moved.state.run?.currentNodeId, legalCommand.nodeId, 'move reaches target exactly once');

  const nonAdjacent = map.nodes.find((node) => !node.isAdjacent && node.state !== 'current');
  assert(nonAdjacent?.moveActionId, 'non-adjacent cell has stable disabled action ID');
  equal(nonAdjacent.canMove, false, 'non-adjacent cannot move');
  const disabled = requireAction(viewModel, nonAdjacent.moveActionId);
  equal(disabled.enabled, false, 'non-adjacent action disabled');
  assert(disabled.event === undefined, 'disabled movement emits no domain event');
  assert(disabled.disabledReason === '仅可移动至相邻节点。', 'non-adjacent reason is explicit');

  const fogged = map.nodes.find((node) => node.state === 'fogged');
  assert(fogged, 'fogged node required');
  assert(fogged.nodeId === undefined && fogged.nodeType === 'unknown' && fogged.title === '未知区域', 'fog hides domain identity');
}

function verifySoulRechargeActivation(): void {
  const entered = buildEnteredState();
  assert(entered.run, 'entered run required for soul recharge');
  const rechargeState: GameState = {
    ...entered,
    phase: 'explore',
    combat: undefined,
    run: {
      ...entered.run,
      currentNodeId: 'upper_fog_patrol',
      clearedNodeIds: [...new Set([...entered.run.clearedNodeIds, 'upper_fog_patrol'])],
      soulSkillState: {
        rulesVersion: 1,
        frozenSkillIds: ['mist_fixed_point'],
        readySkillIds: [],
        chargesRemaining: 0,
        usedRechargeIds: []
      }
    }
  };
  const rechargeView = buildGameViewModel(rechargeState, {});
  verifyActionContract(rechargeView);
  const activation = requireAction(rechargeView, 'soul-recharge.activate:soul_node_demon_mist_watch');
  equal(commandFrom(activation).type, 'node/activate-soul-recharge', 'soul recharge activation command type');
  assert(activation.readout?.includes('雾听定相'), 'soul recharge readout uses the catalog name');
  const activated = reduceGameCommand(rechargeState, commandFrom(activation));
  assert(activated.status === 'committed', 'soul recharge activation commits');
  const pendingView = buildGameViewModel(activated.state, {});
  assert(pendingView.sections[1].detail.kind === 'explore', 'pending soul recharge remains explore');
  equal(pendingView.sections[1].detail.pending?.kind, 'soul-recharge', 'activated soul recharge exposes the existing resolve choice');
  equal(commandFrom(requireAction(pendingView, 'pending.soul-recharge:mist_fixed_point')).type, 'node/resolve-soul-recharge', 'soul recharge resolution remains reachable');

  const nothingSpent: GameState = {
    ...rechargeState,
    run: {
      ...rechargeState.run!,
      soulSkillState: {
        rulesVersion: 1,
        frozenSkillIds: ['mist_fixed_point'],
        readySkillIds: ['mist_fixed_point'],
        chargesRemaining: 1,
        usedRechargeIds: []
      }
    }
  };
  const disabled = requireAction(
    buildGameViewModel(nothingSpent, {}),
    'soul-recharge.activate:soul_node_demon_mist_watch'
  );
  equal(disabled.enabled, false, 'recharge is disabled when no soul skill is spent');
  equal(disabled.disabledReason, '当前没有已消耗的器魂技可恢复。', 'recharge disabled reason comes from core status');
  assert(disabled.event === undefined, 'disabled recharge emits no event');
}

function verifyPendingAndExitGuard(): void {
  const entered = buildEnteredState();
  assert(entered.run, 'entered run required');
  const pendingState: GameState = {
    ...entered,
    run: {
      ...entered.run,
      pendingEquipmentOffer: {
        offerId: 'test-offer',
        equipmentIds: ['mist_hood', 'spirit_robe']
      }
    }
  };
  const pendingView = buildGameViewModel(pendingState, {});
  verifyActionContract(pendingView);
  assert(pendingView.sections[1].detail.kind === 'explore', 'pending explore detail');
  equal(pendingView.sections[1].detail.pending?.kind, 'equipment-offer', 'node pending choice is explicit');
  assert(getActions(pendingView).some((action) => action.actionId.startsWith('pending.equipment:test-offer:')), 'pending choice actions exposed');
  assert(!getActions(pendingView).some((action) => action.actionId === 'node.select:fog_lesser_demon'), 'exclusive equipment pending still suppresses ordinary node actions');
  assert(
    getActions(pendingView).filter((action) => action.placement === 'map').every((action) => !action.enabled && action.event === undefined),
    'pending node choice blocks all movement without commands'
  );

  const exitLocked: GameState = {
    ...entered,
    run: { ...entered.run, currentNodeId: 'tower_exit', clearedNodeIds: [] }
  };
  const lockedView = buildGameViewModel(exitLocked, {});
  const lockedAction = requireAction(lockedView, 'node.exit:tower_exit');
  equal(lockedAction.enabled, false, 'exit remains sealed before boss');
  assert(lockedAction.event === undefined, 'sealed exit cannot settle');

  const exitReady: GameState = {
    ...exitLocked,
    run: { ...exitLocked.run!, clearedNodeIds: ['bone_lane_monster'] }
  };
  const readyView = buildGameViewModel(exitReady, {});
  const exitCommand = commandFrom(requireAction(readyView, 'node.exit:tower_exit'));
  equal(exitCommand.type, 'run/resolve-exit', 'cleared boss unlocks exit command');
  const result = reduceGameCommand(exitReady, exitCommand);
  assert(result.status === 'committed', 'first chapter exit settlement commits');
  equal(result.state.phase, 'result', 'exit reaches result once');
}

function verifyDefaultPendingTrapProjection(): void {
  const state = buildDefaultBloodRuneTrapState();
  const viewModel = buildGameViewModel(state, {});
  verifyActionContract(viewModel);
  assert(viewModel.sections[1].detail.kind === 'explore', 'blood rune stair remains an explore projection');
  const pending = viewModel.sections[1].detail.pending;
  equal(pending?.kind, 'dungeon-event', 'blood rune event pending kind');
  equal(pending?.title, '血字阶梯的呼吸', 'blood rune event pending title');
  equal(
    pending?.actionIds.join(','),
    'pending.event:blood_rune_stair:breathe_through_runes,pending.event:blood_rune_stair:send_pet_first',
    'blood rune event alternatives stay attached to the pending choice'
  );
  const mapActions = getActions(viewModel).filter((action) => action.placement === 'map');
  equal(mapActions.length, 29, 'blood rune stair projects every other map cell');
  assert(mapActions.every((action) => !action.enabled), 'uncleared blood rune trap blocks all movement');

  const breathe = requireAction(viewModel, 'pending.event:blood_rune_stair:breathe_through_runes');
  equal(breathe.enabled, false, 'method alternative remains disabled in a default save');
  equal(breathe.disabledReason, '学会吐纳诀', 'method alternative preserves its unmet prerequisite');
  assert(breathe.event === undefined, 'disabled method alternative emits no command');
  const pet = requireAction(viewModel, 'pending.event:blood_rune_stair:send_pet_first');
  equal(pet.enabled, false, 'pet alternative remains disabled in a default save');
  equal(pet.disabledReason, '激活陷阱侦测灵宠', 'pet alternative preserves its unmet prerequisite');
  assert(pet.event === undefined, 'disabled pet alternative emits no command');

  const counter = requireAction(viewModel, 'node.trap:blood_rune_trap:counter');
  equal(counter.enabled, false, 'missing default counter item keeps the base trap action disabled');
  equal(counter.disabledReason, '缺少破禁符。', 'base trap action preserves its missing-item reason');

  const riskActionId = 'node.trap:blood_rune_trap:risk';
  const risk = requireAction(viewModel, riskActionId);
  equal(risk.label, '强行通过', 'trap fallback title');
  equal(risk.enabled, true, 'trap risk fallback remains executable while its event is pending');
  equal(
    JSON.stringify(commandFrom(risk)),
    JSON.stringify({ type: 'node/handle-trap', choice: 'risk' }),
    'trap fallback command payload'
  );
  equal(
    getActions(viewModel).filter((action) => action.actionId === riskActionId).length,
    1,
    'trap risk fallback is projected exactly once'
  );
  equal(
    getActions(viewModel).filter((action) => action.enabled).map((action) => action.actionId).join(','),
    `${riskActionId},run.retreat`,
    'default pending trap keeps the risk resolution first and the deliberate global retreat escape hatch'
  );
  equal(
    commandFrom(requireAction(viewModel, 'run.retreat')).type,
    'run/retreat',
    'global retreat remains an explicit run-level escape hatch during an optional event'
  );
  const firstDisabledIndex = getActions(viewModel).findIndex((action) => !action.enabled);
  assert(firstDisabledIndex > 0, 'pending trap projection must contain disabled prerequisites');
  assert(
    getActions(viewModel).slice(firstDisabledIndex).every((action) => !action.enabled),
    'enabled pending-trap actions stay ahead of disabled actions'
  );
  equal(getActions(viewModel)[0]?.actionId, riskActionId, 'trap risk fallback is the first reachable action');

  const soulState: GameState = {
    ...state,
    run: {
      ...state.run!,
      soulSkillState: {
        rulesVersion: 1,
        frozenSkillIds: ['mist_fixed_point'],
        readySkillIds: ['mist_fixed_point'],
        chargesRemaining: 1,
        usedRechargeIds: []
      }
    }
  };
  const soulView = buildGameViewModel(soulState, {});
  verifyActionContract(soulView);
  const soulAction = requireAction(soulView, 'soul-skill:mist_fixed_point:use');
  equal(soulAction.enabled, true, 'a context-valid trap soul skill remains available beside event alternatives');
  equal(
    JSON.stringify(commandFrom(soulAction)),
    JSON.stringify({ type: 'node/use-soul-skill', skillId: 'mist_fixed_point' }),
    'context-valid trap soul skill command payload'
  );
  const soulResolved = reduceGameCommand(soulState, commandFrom(soulAction));
  assert(soulResolved.status === 'committed', 'context-valid trap soul skill must commit through the reducer');
  assert(
    soulResolved.state.run?.clearedNodeIds.includes('blood_rune_trap'),
    'context-valid trap soul skill clears the pending trap'
  );
  assert(
    getActions(soulView)
      .filter((action) => action.actionId.startsWith('soul-skill:'))
      .every((action) => action.actionId.startsWith('soul-skill:mist_fixed_point:')),
    'event pending does not expose soul skills that are not frozen and context-valid'
  );

  const unrelatedSoulState: GameState = {
    ...state,
    run: {
      ...state.run!,
      soulSkillState: {
        rulesVersion: 1,
        frozenSkillIds: ['spirit_grounding'],
        readySkillIds: ['spirit_grounding'],
        chargesRemaining: 1,
        usedRechargeIds: []
      }
    }
  };
  const unrelatedSoul = requireAction(
    buildGameViewModel(unrelatedSoulState, {}),
    'soul-skill:spirit_grounding'
  );
  equal(unrelatedSoul.enabled, false, 'a combat-only soul skill remains disabled on the pending trap');
  assert(unrelatedSoul.event === undefined, 'a context-invalid soul skill emits no command');

  const resolved = reduceGameCommand(state, commandFrom(risk));
  assert(resolved.status === 'committed', 'projected trap risk fallback must execute in the application reducer');
  assert(resolved.state.run?.clearedNodeIds.includes('blood_rune_trap'), 'executed trap fallback clears blood rune stair');
}

function verifyCombatAndSingleAdvance(): GameState {
  const entered = buildEnteredState();
  const exploreView = buildGameViewModel(entered, {});
  const select = requireAction(exploreView, 'node.select:fog_lesser_demon');
  const combatResult = reduceGameCommand(entered, commandFrom(select));
  assert(combatResult.status === 'committed', 'first chapter monster starts combat');
  equal(combatResult.state.phase, 'combat', 'combat phase reached');
  const viewModel = buildGameViewModel(combatResult.state, { advancedCombatExpanded: true });
  verifyActionContract(viewModel);
  assert(viewModel.sections[1].detail.kind === 'combat', 'combat detail');
  equal(viewModel.visualAssetKey, `monster:${combatResult.state.combat?.monsterId}`, 'combat visual key follows the encounter monster');
  assert(getGameAsset('monster', combatResult.state.combat!.monsterId)?.key === viewModel.visualAssetKey, 'combat visual key exists in core');
  assert(viewModel.sections[1].detail.player.hp > 0, 'player HP exposed');
  assert(viewModel.sections[1].detail.enemy.hp > 0, 'enemy HP exposed');
  assert(viewModel.sections[1].detail.intent.consequence.length > 0, 'intent consequence exposed');
  assert(
    viewModel.sections[1].detail.intent.recommendedActions.length > 0,
    'combat preserves intent recommendations even when the recommended resource is unavailable'
  );
  assert(
    getActions(viewModel).some((action) => action.riskReason && action.recommendation === 'high-risk'),
    'combat exposes high-risk action reasons'
  );
  const attack = requireAction(viewModel, 'combat.action:attack');
  const resolved = reduceGameCommand(combatResult.state, commandFrom(attack));
  assert(resolved.status === 'committed', 'attack commits');
  const turnEvents = resolved.events.filter((event) => event.type === 'combat.turn-resolved');
  equal(turnEvents.length, 1, 'one presentation action advances one combat turn');
  const event = turnEvents[0];
  assert(event.type === 'combat.turn-resolved', 'turn event narrowed');
  equal(event.turnAfter - event.turnBefore, 1, 'turn advances by exactly one');
  return combatResult.state;
}

function verifyBossAndResult(combatBase: GameState): void {
  assert(combatBase.run && combatBase.combat, 'combat snapshot required');
  const sealedBoss: GameState = {
    ...combatBase,
    run: { ...combatBase.run, currentNodeId: 'bone_lane_monster' },
    combat: {
      ...combatBase.combat,
      nodeId: 'bone_lane_monster',
      monsterId: 'tower_butcher',
      monsterHp: 60,
      bossPhase: 'sealed'
    }
  };
  const sealedView = buildGameViewModel(sealedBoss, {});
  assert(sealedView.sections[1].detail.kind === 'combat', 'sealed boss combat detail');
  equal(sealedView.sections[1].detail.boss?.phase, 'sealed', 'boss sealed phase');
  const awakenedView = buildGameViewModel({
    ...sealedBoss,
    combat: { ...sealedBoss.combat!, bossPhase: 'awakened' }
  }, {});
  assert(awakenedView.sections[1].detail.kind === 'combat', 'awakened boss combat detail');
  equal(awakenedView.sections[1].detail.boss?.phase, 'awakened', 'boss awakened phase');
  assert(awakenedView.sections[1].detail.boss?.phaseLabel !== sealedView.sections[1].detail.boss?.phaseLabel, 'boss phases have non-color labels');

  const pendingResult: GameState = {
    ...combatBase,
    phase: 'result',
    combat: undefined,
    lastOutcome: 'outcome=completed',
    run: {
      ...combatBase.run,
      lastRelicSettlement: {
        status: 'pending',
        frame: 'assault',
        acquiredIds: ['mist_edge']
      }
    }
  };
  const resultView = buildGameViewModel(pendingResult, {});
  verifyActionContract(resultView);
  JSON.parse(JSON.stringify(resultView));
  equal(resultView.phase, 'result', 'result phase');
  equal(resultView.visualAssetKey, `dungeon:${pendingResult.run?.dungeonId}`, 'result retains the settled dungeon visual');
  assert(getGameAsset('dungeon', pendingResult.run!.dungeonId)?.key === resultView.visualAssetKey, 'result visual key exists in core');
  assert(resultView.sections[1].detail.kind === 'result', 'result detail');
  const returnBlocked = requireAction(resultView, 'result.return-hub');
  equal(returnBlocked.enabled, false, 'return blocked while relic archive pending');
  assert(returnBlocked.event === undefined, 'blocked result action emits nothing');
  assert(!getActions(resultView).some((action) => action.event?.kind === 'command' && action.event.command.type === 'run/resolve-exit'), 'result never repeats exit settlement');

  const archivedResult: GameState = {
    ...pendingResult,
    run: {
      ...pendingResult.run!,
      lastRelicSettlement: {
        status: 'archived',
        frame: 'assault',
        acquiredIds: ['mist_edge'],
        archivedRelicId: 'mist_edge'
      }
    }
  };
  const archivedView = buildGameViewModel(archivedResult, {});
  verifyActionContract(archivedView);
  const returnAction = requireAction(archivedView, 'result.return-hub');
  equal(commandFrom(returnAction).type, 'result/return-hub', 'archived result returns to hub');
  assert(!getActions(archivedView).some((action) => action.actionId.startsWith('result.archive-relic:')), 'archive cannot be submitted twice');
}

function verifyAbnormalVisualFallbacks(): void {
  const initial = createInitialState();
  const missingExplore: GameState = {
    ...initial,
    phase: 'explore',
    run: undefined,
    combat: undefined
  };
  equal(buildGameViewModel(missingExplore, {}).visualAssetKey, undefined, 'missing explore snapshot has no invented visual key');

  const missingCombat: GameState = {
    ...initial,
    phase: 'combat',
    run: undefined,
    combat: undefined
  };
  equal(buildGameViewModel(missingCombat, {}).visualAssetKey, undefined, 'missing combat snapshot has no invented visual key');

  const missingResult: GameState = {
    ...initial,
    phase: 'result',
    run: undefined,
    combat: undefined
  };
  equal(buildGameViewModel(missingResult, {}).visualAssetKey, undefined, 'missing result snapshot has no invented visual key');
}

function verifyTokensAndJson(): void {
  equal(COCOS_DESIGN_TOKENS.coordinateSpace.width, 750, 'design width');
  equal(COCOS_DESIGN_TOKENS.coordinateSpace.height, 1334, 'design height');
  equal(COCOS_DESIGN_TOKENS.touch.minimumViewportPx, 44, 'physical touch minimum');
  assert(COCOS_DESIGN_TOKENS.touch.minimumDesignPxAt390 >= 85, '390-wide design target');
  assert(COCOS_DESIGN_TOKENS.touch.minimumDesignPxAt320 >= 104, '320-wide compact design target');
  equal(COCOS_DESIGN_TOKENS.safeAreaProfiles.compact.fallbackInsets.unit, 'viewport-px', 'safe insets use viewport units');
  assert(COCOS_DESIGN_TOKENS.contrast.regularTextMinimum >= 4.5, 'regular text contrast threshold');
  for (const state of Object.values(COCOS_DESIGN_TOKENS.mapStates)) {
    assert(state.label.length > 0 && state.symbol.length > 0 && state.pattern.length > 0, 'map state has non-color encoding');
  }
  const allPhases = [createInitialState(), buildEnteredState(), verifyCombatAndSingleAdvance()];
  for (const state of allPhases) JSON.parse(JSON.stringify(buildGameViewModel(state, {})));
}

function verifyChapterDecisionProjection(): void {
  const enterChapter = (dungeonId: DungeonId, routeContractId?: string): GameState => {
    const hub = buildRichHubState();
    const enter: GameCommand = {
      type: 'run/enter',
      dungeonId,
      protocolId: 'standard',
      ...(routeContractId ? { routeContractId } : {}),
      seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 }
    };
    const result = reduceGameCommand(hub, enter);
    if (result.status !== 'committed') throw new Error(`enter ${dungeonId}: ${result.reason.message}`);
    if (result.state.phase !== 'explore') throw new Error(`enter ${dungeonId}: expected explore phase`);
    return result.state;
  };

  const exploreDetail = (viewModel: GameViewModel) => {
    const detail = viewModel.sections[1].detail;
    if (detail.kind !== 'explore') throw new Error('expected explore detail');
    return detail;
  };

  const chapterDecision = (viewModel: GameViewModel) => {
    const decision = exploreDetail(viewModel).chapterDecision;
    assert(decision, 'explore detail exposes chapterDecision');
    return decision;
  };

  const CHAPTERS: ReadonlyArray<Readonly<{
    dungeonId: DungeonId;
    objectiveKinds: readonly string[];
    objectiveCompleted: readonly boolean[];
  }>> = [
    { dungeonId: 'metro_abyss', objectiveKinds: ['low_damage', 'no_item', 'equip'], objectiveCompleted: [true, true, false] },
    { dungeonId: 'starfall_mine', objectiveKinds: ['equip', 'method', 'hidden_clear'], objectiveCompleted: [false, false, false] },
    { dungeonId: 'rust_hospital', objectiveKinds: ['low_damage', 'method', 'no_item'], objectiveCompleted: [true, false, true] }
  ];

  for (const chapter of CHAPTERS) {
    const state = enterChapter(chapter.dungeonId);
    const viewModel = buildGameViewModel(state, {});
    verifyActionContract(viewModel);
    const decision = chapterDecision(viewModel);
    equal(decision.dungeonId, chapter.dungeonId, 'chapter decision dungeon id');
    assert(decision.dungeonName.length > 0, 'chapter decision dungeon name');

    equal(decision.law.present, true, `${chapter.dungeonId} law card present`);
    assert(decision.law.title.length > 0, `${chapter.dungeonId} law title`);
    assert(decision.law.status.length > 0, `${chapter.dungeonId} law status`);
    assert(typeof decision.law.targetReached === 'boolean', `${chapter.dungeonId} law target flag`);
    assert(typeof decision.law.modifiers.encounter.allStatsPercent === 'number', `${chapter.dungeonId} law encounter modifier`);
    assert(typeof decision.law.modifiers.trap.damagePercent === 'number', `${chapter.dungeonId} law trap modifier`);
    assert(typeof decision.law.modifiers.healingPercent === 'number', `${chapter.dungeonId} law healing modifier`);
    assert(typeof decision.law.modifiers.outgoingDamage.forcePercent === 'number', `${chapter.dungeonId} law outgoing modifier`);
    assert(typeof decision.law.modifiers.guardEffectPercent === 'number', `${chapter.dungeonId} law guard modifier`);

    equal(decision.directive.status, 'active', `${chapter.dungeonId} fresh directive active`);
    equal(decision.directive.objectives.length, 3, `${chapter.dungeonId} directive objective count`);
    equal(
      decision.directive.objectives.map((objective) => objective.kind).join(','),
      chapter.objectiveKinds.join(','),
      `${chapter.dungeonId} directive objective kinds`
    );
    equal(
      decision.directive.objectives.map((objective) => objective.completed).join(','),
      chapter.objectiveCompleted.join(','),
      `${chapter.dungeonId} directive objective completion`
    );
    for (const objective of decision.directive.objectives) {
      assert(objective.id.length > 0 && objective.label.length > 0 && objective.description.length > 0, `${chapter.dungeonId} objective copy`);
      assert(objective.progressText.length > 0, `${chapter.dungeonId} objective progress text`);
    }
    assert(decision.directive.progressText.length > 0, `${chapter.dungeonId} directive progress text`);
    assert(decision.directive.rewardPreview.length > 0, `${chapter.dungeonId} directive reward preview`);

    equal(decision.routeContract.enabled, false, `${chapter.dungeonId} no-contract entry disables route contract`);
    equal(decision.routeContract.status, 'disabled', `${chapter.dungeonId} no-contract status`);
    equal(decision.routeContract.completedTargetCount, 0, `${chapter.dungeonId} disabled contract zero progress`);
    equal(decision.routeContract.completedReadout, '0 / 2', `${chapter.dungeonId} disabled contract readout`);
    equal(decision.routeContract.orderedTargets.length, 0, `${chapter.dungeonId} disabled contract has no targets`);

    equal(decision.pressure.present, true, `${chapter.dungeonId} modern pressure present`);
    equal(decision.pressure.legacyDisabled, false, `${chapter.dungeonId} modern pressure not legacy`);
    equal(decision.pressure.tier, 'stable', `${chapter.dungeonId} fresh pressure stable`);

    equal(decision.pursuit.present, true, `${chapter.dungeonId} replay pursuit present`);
    equal(decision.pursuit.status, 'dormant', `${chapter.dungeonId} replay pursuit dormant`);
    equal(decision.pursuit.progress?.active, false, `${chapter.dungeonId} dormant pursuit inactive`);
  }

  // Ordered route-contract progress 0/2 -> 1/2 -> 2/2 and failure on metro_abyss.
  const metroContract = listRouteContracts('metro_abyss')[0]!;
  const metroState = enterChapter('metro_abyss', metroContract.id);
  const metroDecision = chapterDecision(buildGameViewModel(metroState, {}));
  equal(metroDecision.routeContract.enabled, true, 'contracted entry enables route contract');
  equal(metroDecision.routeContract.status, 'active', 'contracted entry active');
  equal(metroDecision.routeContract.completedTargetCount, 0, 'contracted entry 0/2');
  equal(metroDecision.routeContract.completedReadout, '0 / 2', 'contracted entry readout');
  equal(metroDecision.routeContract.display.key, 'pending_first', '0/2 display key');
  equal(metroDecision.routeContract.orderedTargets.length, 2, 'contracted entry two targets');
  equal(metroDecision.routeContract.orderedTargets[0]?.nodeId, metroContract.targetNodeIds[0], 'first target node');
  equal(metroDecision.routeContract.orderedTargets[1]?.nodeId, metroContract.targetNodeIds[1], 'second target node');
  equal(metroDecision.routeContract.nextTarget?.nodeId, metroContract.targetNodeIds[0], 'fresh contract next target is first');
  equal(metroDecision.routeContract.potentialRewardPoints, metroContract.rewardPoints, 'contract potential reward');
  equal(metroDecision.routeContract.bankedRewardPoints, 0, 'fresh contract banks nothing');
  equal(metroDecision.routeContract.name, metroContract.name, 'contract name');

  const oneTargetState: GameState = {
    ...metroState,
    run: {
      ...metroState.run!,
      routeContractState: {
        rulesVersion: 1,
        contractId: metroContract.id,
        dungeonId: metroContract.dungeonId,
        completedTargetCount: 1 as const,
        status: 'active' as const
      }
    }
  };
  const oneTargetDecision = chapterDecision(buildGameViewModel(oneTargetState, {}));
  equal(oneTargetDecision.routeContract.completedTargetCount, 1, '1/2 progress');
  equal(oneTargetDecision.routeContract.completedReadout, '1 / 2', '1/2 readout');
  equal(oneTargetDecision.routeContract.display.key, 'pending_second', '1/2 display key');
  equal(oneTargetDecision.routeContract.nextTarget?.nodeId, metroContract.targetNodeIds[1], '1/2 next target is second');

  const twoTargetState: GameState = {
    ...metroState,
    run: {
      ...metroState.run!,
      routeContractState: {
        rulesVersion: 1,
        contractId: metroContract.id,
        dungeonId: metroContract.dungeonId,
        completedTargetCount: 2 as const,
        status: 'secured' as const
      }
    }
  };
  const twoTargetDecision = chapterDecision(buildGameViewModel(twoTargetState, {}));
  equal(twoTargetDecision.routeContract.completedTargetCount, 2, '2/2 progress');
  equal(twoTargetDecision.routeContract.completedReadout, '2 / 2', '2/2 readout');
  equal(twoTargetDecision.routeContract.display.key, 'secured', '2/2 display key');
  equal(twoTargetDecision.routeContract.nextTarget, undefined, 'secured contract has no next target');
  equal(twoTargetDecision.routeContract.bankedRewardPoints, 0, 'secured reward not yet banked');

  const failedContractState: GameState = {
    ...metroState,
    run: {
      ...metroState.run!,
      routeContractState: {
        rulesVersion: 1,
        contractId: metroContract.id,
        dungeonId: metroContract.dungeonId,
        completedTargetCount: 0 as const,
        status: 'failed' as const,
        reason: 'out_of_order' as const
      }
    }
  };
  const failedContractDecision = chapterDecision(buildGameViewModel(failedContractState, {}));
  equal(failedContractDecision.routeContract.status, 'failed', 'failed contract status');
  equal(failedContractDecision.routeContract.display.key, 'failed', 'failed display key');
  equal(failedContractDecision.routeContract.reason, 'out_of_order', 'failed reason preserved');

  // The other two chapters also expose their first contract at 0/2 with ordered targets.
  for (const dungeonId of ['starfall_mine', 'rust_hospital'] as const) {
    const contract = listRouteContracts(dungeonId)[0]!;
    const state = enterChapter(dungeonId, contract.id);
    const decision = chapterDecision(buildGameViewModel(state, {}));
    equal(decision.routeContract.status, 'active', `${dungeonId} contract active`);
    equal(decision.routeContract.completedTargetCount, 0, `${dungeonId} contract 0/2`);
    equal(
      decision.routeContract.orderedTargets.map((target) => target.nodeId).join(','),
      contract.targetNodeIds.join(','),
      `${dungeonId} ordered targets`
    );
    equal(decision.routeContract.potentialRewardPoints, contract.rewardPoints, `${dungeonId} reward`);
  }

  // Pressure tiers on rust_hospital.
  const rustState = enterChapter('rust_hospital');
  const rustDecision = chapterDecision(buildGameViewModel(rustState, {}));
  equal(rustDecision.pressure.tier, 'stable', 'fresh pressure stable');
  equal(rustDecision.pressure.pressurePercent, 0, 'stable pressure percent');
  equal(rustDecision.pressure.rewardBonusPercent, 15, 'stable reward bonus');
  equal(rustDecision.pressure.nextTierAt, 6, 'stable next tier at six clears');
  const huntedState: GameState = {
    ...rustState,
    run: { ...rustState.run!, pressureState: { rulesVersion: 1, clearedNodeCount: 6 } }
  };
  const huntedDecision = chapterDecision(buildGameViewModel(huntedState, {}));
  equal(huntedDecision.pressure.tier, 'hunted', 'hunted pressure tier');
  equal(huntedDecision.pressure.pressurePercent, 10, 'hunted pressure percent');
  equal(huntedDecision.pressure.rewardBonusPercent, 5, 'hunted reward bonus');
  equal(huntedDecision.pressure.nextTierAt, 12, 'hunted next tier at twelve clears');
  const breachState: GameState = {
    ...rustState,
    run: { ...rustState.run!, pressureState: { rulesVersion: 1, clearedNodeCount: 12 } }
  };
  const breachDecision = chapterDecision(buildGameViewModel(breachState, {}));
  equal(breachDecision.pressure.tier, 'breach', 'breach pressure tier');
  equal(breachDecision.pressure.pressurePercent, 20, 'breach pressure percent');
  equal(breachDecision.pressure.rewardBonusPercent, 0, 'breach reward bonus');
  equal(breachDecision.pressure.nextTierAt, null, 'breach has no next tier');

  // Pursuit dormant -> stalking on starfall_mine.
  const mineState = enterChapter('starfall_mine');
  const mineDecision = chapterDecision(buildGameViewModel(mineState, {}));
  equal(mineDecision.pursuit.status, 'dormant', 'replay pursuit dormant');
  equal(mineDecision.pursuit.progress?.clearsRemaining, 6, 'dormant pursuit shows six clears to spawn');
  const pursuitDefinition = getRunPursuitDefinition('starfall_mine');
  assert(pursuitDefinition, 'starfall_mine pursuit definition');
  const stalkingState: GameState = {
    ...mineState,
    run: {
      ...mineState.run!,
      pursuitState: {
        rulesVersion: 1,
        dungeonId: pursuitDefinition.dungeonId,
        status: 'stalking' as const,
        nodeId: pursuitDefinition.spawnNodeId,
        contacts: 0,
        graceMoves: 0 as const,
        rewardGranted: false,
        repelledReason: null
      }
    }
  };
  const stalkingDecision = chapterDecision(buildGameViewModel(stalkingState, {}));
  equal(stalkingDecision.pursuit.status, 'stalking', 'activated pursuit stalking');
  equal(stalkingDecision.pursuit.progress?.active, true, 'stalking pursuit active');
  equal(stalkingDecision.pursuit.progress?.currentNodeId, pursuitDefinition.spawnNodeId, 'stalking pursuit spawn node');
  equal(stalkingDecision.pursuit.name, pursuitDefinition.name, 'pursuit name from definition');
  equal(stalkingDecision.pursuit.contactDamagePercent, pursuitDefinition.contactDamagePercent, 'pursuit contact damage');

  // Pending coexistence: chapterDecision stays projected beside an exclusive pending choice.
  const pendingState: GameState = {
    ...metroState,
    run: {
      ...metroState.run!,
      pendingEquipmentOffer: {
        offerId: 'chapter-decision-offer',
        equipmentIds: ['mist_hood', 'spirit_robe']
      }
    }
  };
  const pendingViewModel = buildGameViewModel(pendingState, {});
  verifyActionContract(pendingViewModel);
  const pendingDetail = exploreDetail(pendingViewModel);
  assert(pendingDetail.chapterDecision, 'chapterDecision coexists with pending equipment offer');
  equal(pendingDetail.pending?.kind, 'equipment-offer', 'pending choice still projected beside chapterDecision');
  assert(
    getActions(pendingViewModel).some((action) => action.actionId.startsWith('pending.equipment:chapter-decision-offer:')),
    'pending choice actions remain reachable'
  );

  // Action invariance: the read-only chapter decision projection adds no new action surface.
  const freshViewModel = buildGameViewModel(metroState, {});
  verifyActionContract(freshViewModel);
  const allowedActionPrefixes = ['map.move:', 'node.', 'pending.', 'run.retreat', 'soul-skill:', 'soul-recharge.', 'law.'];
  for (const action of getActions(freshViewModel)) {
    assert(
      allowedActionPrefixes.some((prefix) => action.actionId === prefix || action.actionId.startsWith(prefix)),
      `chapter decision projection adds no actions: ${action.actionId}`
    );
  }
  const rebuiltViewModel = buildGameViewModel(metroState, {});
  equal(
    getActions(freshViewModel).map((action) => `${action.actionId}:${action.enabled ? 'on' : 'off'}`).join('|'),
    getActions(rebuiltViewModel).map((action) => `${action.actionId}:${action.enabled ? 'on' : 'off'}`).join('|'),
    'chapter decision projection is deterministic'
  );

  // JSON serialization, deep freeze, and detachment.
  const snapshotViewModel = buildGameViewModel(metroState, {});
  const snapshotDecision = chapterDecision(snapshotViewModel);
  JSON.parse(JSON.stringify(snapshotDecision));
  JSON.parse(JSON.stringify(snapshotViewModel));
  assert(Object.isFrozen(snapshotDecision), 'chapterDecision root frozen');
  assert(Object.isFrozen(snapshotDecision.directive.objectives), 'directive objectives frozen');
  assert(Object.isFrozen(snapshotDecision.routeContract.orderedTargets), 'route targets frozen');
  assert(Object.isFrozen(snapshotDecision.pursuit.progress), 'pursuit progress frozen');
  assert(Object.isFrozen(snapshotDecision.law.modifiers), 'law modifiers frozen');
  const damagedState: GameState = {
    ...metroState,
    run: { ...metroState.run!, damageTaken: 999 }
  };
  const damagedDecision = chapterDecision(buildGameViewModel(damagedState, {}));
  equal(
    snapshotDecision.directive.objectives.find((objective) => objective.kind === 'low_damage')?.completed,
    true,
    'snapshot keeps zero-damage objective after source copy mutates'
  );
  equal(
    damagedDecision.directive.objectives.find((objective) => objective.kind === 'low_damage')?.completed,
    false,
    'rebuilt projection reads mutated damage'
  );
}

function verifyCombatChapterContext(): void {
  // Every chapter below is entered through the real reducer, navigated to a monster node with
  // real run/move commands, and started with a real run/select-node command. The combat chapter
  // context is a read-only projection; it adds no commands, actions, randomness, or state writes.
  const enterChapter = (dungeonId: DungeonId): GameState => {
    const hub = buildRichHubState();
    const enter: GameCommand = {
      type: 'run/enter',
      dungeonId,
      protocolId: 'standard',
      seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 }
    };
    const result = reduceGameCommand(hub, enter);
    if (result.status !== 'committed') throw new Error(`enter ${dungeonId}: ${result.reason.message}`);
    if (result.state.phase !== 'explore') throw new Error(`enter ${dungeonId}: expected explore phase`);
    return result.state;
  };

  const moveToNode = (state: GameState, nodeId: string): GameState => {
    const view = buildGameViewModel(state, {});
    const move = getActions(view).find((action) => {
      if (!action.enabled || action.event?.kind !== 'command') return false;
      if (!action.actionId.startsWith('map.move:')) return false;
      const command = action.event.command as GameCommand & { nodeId?: string };
      return command.type === 'run/move' && command.nodeId === nodeId;
    });
    if (!move) throw new Error(`move to ${nodeId} unavailable`);
    return committed(state, commandFrom(move), `move to ${nodeId}`);
  };

  const startCombatAt = (state: GameState, nodeId: string): GameState => {
    const view = buildGameViewModel(state, {});
    const select = requireAction(view, `node.select:${nodeId}`);
    const result = reduceGameCommand(state, commandFrom(select));
    if (result.status !== 'committed') throw new Error(`select ${nodeId}: ${result.reason.message}`);
    if (result.state.phase !== 'combat') throw new Error(`select ${nodeId}: expected combat, got ${result.state.phase}`);
    return result.state;
  };

  const combatDetail = (state: GameState) => {
    const detail = buildGameViewModel(state, {}).sections[1].detail;
    if (detail.kind !== 'combat') throw new Error('expected combat detail');
    return detail;
  };

  const combatRisks = (state: GameState) => {
    const model = buildGameViewModel(state, {});
    verifyActionContract(model);
    return model.sections[3].items;
  };

  // Chapter 2 (metro_abyss): tide_boatman is adjacent to the start platform.
  const metroCombat = startCombatAt(moveToNode(enterChapter('metro_abyss'), 'tide_boatman'), 'tide_boatman');
  // Chapter 3 (starfall_mine): shell_patrol_alpha is adjacent to the arrival lift.
  const mineCombat = startCombatAt(moveToNode(enterChapter('starfall_mine'), 'shell_patrol_alpha'), 'shell_patrol_alpha');
  // Chapter 4 (rust_hospital): plague_orderly is two steps from the triage start.
  const rustCombat = startCombatAt(
    moveToNode(moveToNode(enterChapter('rust_hospital'), 'medicine_cabinet'), 'plague_orderly'),
    'plague_orderly'
  );

  const CHAPTER_COMBATS: ReadonlyArray<Readonly<{ dungeonId: DungeonId; state: GameState; lawTitle: string }>> = [
    { dungeonId: 'metro_abyss', state: metroCombat, lawTitle: '末班潮序' },
    { dungeonId: 'starfall_mine', state: mineCombat, lawTitle: '重力极向' },
    { dungeonId: 'rust_hospital', state: rustCombat, lawTitle: '锈疫污染' }
  ];

  for (const chapter of CHAPTER_COMBATS) {
    const detail = combatDetail(chapter.state);
    assert(detail.chapterContext, `${chapter.dungeonId} combat exposes chapterContext`);
    const context = detail.chapterContext!;
    equal(context.dungeonId, chapter.dungeonId, `${chapter.dungeonId} context dungeon id`);
    assert(context.dungeonName.length > 0, `${chapter.dungeonId} context dungeon name`);

    assert(context.law.present, `${chapter.dungeonId} law present in combat`);
    equal(context.law.title, chapter.lawTitle, `${chapter.dungeonId} law title`);
    assert(context.law.status.length > 0, `${chapter.dungeonId} law status`);
    assert(
      ['stable', 'warning', 'danger', 'resolved'].includes(context.law.severity),
      `${chapter.dungeonId} law severity`
    );
    const m = context.law.modifiers;
    for (const value of [
      m.enemyAllStatsPercent, m.enemyDefensePercent, m.enemyArtPowerPercent,
      m.outgoingForcePercent, m.outgoingArtPercent, m.healingPercent, m.guardEffectPercent
    ]) {
      assert(typeof value === 'number' && Number.isFinite(value), `${chapter.dungeonId} law modifier is a finite number`);
    }

    assert(context.pursuit.present, `${chapter.dungeonId} pursuit present in combat`);
    assert(context.pursuit.name && context.pursuit.name.length > 0, `${chapter.dungeonId} pursuit name`);
    equal(context.pursuit.status, 'dormant', `${chapter.dungeonId} fresh pursuit dormant`);
    assert(typeof context.pursuit.contactDamagePercent === 'number', `${chapter.dungeonId} pursuit contact damage`);
    assert(typeof context.pursuit.bossFusionPercent === 'number', `${chapter.dungeonId} pursuit boss fusion`);

    // The read-only context adds no actions and no events.
    const model = buildGameViewModel(chapter.state, {});
    verifyActionContract(model);
    for (const action of getActions(model)) {
      assert(
        action.actionId.startsWith('combat.') || action.actionId === 'run.retreat' || action.actionId.startsWith('soul-skill:'),
        `${chapter.dungeonId} combat context adds no non-combat actions: ${action.actionId}`
      );
    }
  }

  // Rust hospital law meter (pollution 0/4 on a fresh run) and danger escalation.
  const rustDetail = combatDetail(rustCombat);
  assert(rustDetail.chapterContext?.law.meter, 'rust_hospital law meter exposed');
  equal(rustDetail.chapterContext!.law.meter!.max, 4, 'rust_hospital pollution meter max');
  const rustLawState = rustCombat.run!.lawState;
  assert(rustLawState, 'rust_hospital run carries a law state');
  const dangerousRust: GameState = {
    ...rustCombat,
    run: {
      ...rustCombat.run!,
      lawState: { ...rustLawState!, law: { kind: 'rust_hospital' as const, pollution: 4 } }
    }
  };
  const dangerousDetail = combatDetail(dangerousRust);
  equal(dangerousDetail.chapterContext?.law.severity, 'danger', 'pollution 4/4 escalates law severity to danger');
  equal(dangerousDetail.chapterContext?.law.meter?.value, 4, 'pollution meter reads 4/4');
  const dangerousRisks = combatRisks(dangerousRust);
  assert(
    dangerousRisks.some((risk) => risk.id === 'combat-law-danger' && risk.severity === 'danger'),
    'danger law appends a combat-law-danger risk'
  );

  // Pursuit dormant -> stalking on starfall_mine appends a pursuit risk.
  const mineDefinition = getRunPursuitDefinition('starfall_mine');
  assert(mineDefinition, 'starfall_mine pursuit definition');
  const stalkingMine: GameState = {
    ...mineCombat,
    run: {
      ...mineCombat.run!,
      pursuitState: {
        rulesVersion: 1,
        dungeonId: mineDefinition.dungeonId,
        status: 'stalking' as const,
        nodeId: mineDefinition.spawnNodeId,
        contacts: 0,
        graceMoves: 0 as const,
        rewardGranted: false,
        repelledReason: null
      }
    }
  };
  const stalkingDetail = combatDetail(stalkingMine);
  equal(stalkingDetail.chapterContext?.pursuit.status, 'stalking', 'stalking pursuit projected in combat');
  const stalkingRisks = combatRisks(stalkingMine);
  assert(
    stalkingRisks.some((risk) => risk.id === 'combat-pursuit-active' && risk.severity === 'warning'),
    'stalking pursuit appends a combat-pursuit-active warning risk'
  );

  // Fused pursuit escalates the risk to danger. The core normalizer requires nodeId=null
  // for a fused pursuit, so the fused state is built explicitly.
  const fusedMine: GameState = {
    ...stalkingMine,
    run: {
      ...stalkingMine.run!,
      pursuitState: {
        rulesVersion: 1,
        dungeonId: mineDefinition.dungeonId,
        status: 'fused' as const,
        nodeId: null,
        contacts: 0,
        graceMoves: 0 as const,
        rewardGranted: false,
        repelledReason: null
      }
    }
  };
  const fusedRisks = combatRisks(fusedMine);
  assert(
    fusedRisks.some((risk) => risk.id === 'combat-pursuit-active' && risk.severity === 'danger'),
    'fused pursuit escalates the risk to danger'
  );

  // Fail-closed: a corrupt law snapshot is rejected by the core normalizer; the combat context
  // shows the chapter default law, never inventing titles, percentages, or rewards.
  const corruptLawRun: GameState = {
    ...metroCombat,
    run: {
      ...metroCombat.run!,
      lawState: {
        ...metroCombat.run!.lawState!,
        law: { kind: 'metro_abyss' as const, tide: 'tsunami' as never }
      }
    }
  };
  const corruptDetail = combatDetail(corruptLawRun);
  assert(corruptDetail.chapterContext, 'corrupt law run still exposes context');
  assert(corruptDetail.chapterContext!.law.present, 'corrupt law falls back to the chapter default law');
  equal(corruptDetail.chapterContext!.law.title, '末班潮序', 'corrupt law uses the real chapter law title');
  equal(
    corruptDetail.chapterContext!.law.status.includes('退潮'),
    true,
    'corrupt law falls back to the default ebb tide, not the injected mirror tide'
  );
  const corruptRisks = combatRisks(corruptLawRun);
  assert(
    !corruptRisks.some((risk) => risk.id === 'combat-law-danger'),
    'corrupt-but-default law emits no law-danger risk'
  );

  // JSON serialization, deep freeze, and detachment.
  const snapshotDetail = combatDetail(metroCombat);
  const snapshotContext = snapshotDetail.chapterContext!;
  JSON.parse(JSON.stringify(snapshotContext));
  JSON.parse(JSON.stringify(snapshotDetail));
  assert(Object.isFrozen(snapshotContext), 'combat chapterContext root frozen');
  assert(Object.isFrozen(snapshotContext.law.modifiers), 'combat law modifiers frozen');
  assert(Object.isFrozen(snapshotContext.pursuit), 'combat pursuit frozen');
  const mutatedSource: GameState = {
    ...metroCombat,
    run: {
      ...metroCombat.run!,
      lawState: metroCombat.run!.lawState
        ? { ...metroCombat.run!.lawState, law: { kind: 'metro_abyss' as const, tide: 'mirror' as const } }
        : undefined
    }
  };
  const mutatedDetail = combatDetail(mutatedSource);
  equal(
    snapshotContext.law.status.includes('退潮') || snapshotContext.law.status.includes('涨潮'),
    true,
    'snapshot keeps original tide after source copy mutates'
  );
  equal(
    mutatedDetail.chapterContext!.law.status.includes('镜潮'),
    true,
    'rebuilt projection reads mutated tide'
  );

  // Action invariance: the context projection is deterministic and adds no action surface.
  const freshModel = buildGameViewModel(metroCombat, {});
  const rebuiltModel = buildGameViewModel(metroCombat, {});
  equal(
    getActions(freshModel).map((action) => `${action.actionId}:${action.enabled ? 'on' : 'off'}`).join('|'),
    getActions(rebuiltModel).map((action) => `${action.actionId}:${action.enabled ? 'on' : 'off'}`).join('|'),
    'combat chapter context projection is deterministic'
  );
}

function verifyResultSettlement(): void {
  // Fixed seeds travel only through the run/enter payload. Every transition below is a real,
  // serializable command reduced by the application reducer; phase/hp/clearedNodeIds/combat/
  // last-settlement fields are never assigned or spread-tampered.
  const NORMAL_ENTRY_SEEDS = { rulesVersion: 1 as const, hiddenTaskSeed: 0x1234_abcd };
  type LootBag = NonNullable<GameState['run']>['lootBag'];
  type FlowResult = Readonly<{ result: GameState; bag: LootBag }>;
  type AnyResultSettlement =
    | NonNullable<ResultDetailViewModel['lootSettlement']>
    | NonNullable<ResultDetailViewModel['equipmentRollSettlement']>
    | NonNullable<ResultDetailViewModel['protocolSettlement']>
    | NonNullable<ResultDetailViewModel['directiveSettlement']>
    | NonNullable<ResultDetailViewModel['routeContractSettlement']>
    | NonNullable<ResultDetailViewModel['pressureSettlement']>
    | NonNullable<ResultDetailViewModel['pursuitSettlement']>;
  type ValidLootCard = Extract<NonNullable<ResultDetailViewModel['lootSettlement']>, { state: 'valid' }>;

  function enterNormalRun(hub: GameState): GameState {
    equal(hub.phase, 'hub', 'normal entry starts from the hub');
    const entered = committed(hub, {
      type: 'run/enter',
      dungeonId: 'demon_tower_1',
      protocolId: 'standard',
      seeds: NORMAL_ENTRY_SEEDS
    }, 'normal entry must commit');
    equal(entered.phase, 'explore', 'normal entry reaches explore');
    equal(entered.run?.currentNodeId, 'fog_lesser_demon', 'normal entry start node');
    equal(entered.run?.hiddenTaskSeed, 0x1234_abcd, 'fixed seed is carried only by the enter payload');
    return entered;
  }

  function moveTo(state: GameState, nodeId: string): GameState {
    const view = buildGameViewModel(state, {});
    const action = getActions(view).find((candidate) =>
      candidate.event?.kind === 'command'
      && candidate.event.command.type === 'run/move'
      && candidate.event.command.nodeId === nodeId
    );
    assert(action, `move action to ${nodeId} must be exposed`);
    return committed(state, commandFrom(action), `move to ${nodeId} must commit`);
  }

  function selectNode(state: GameState, nodeId: string): GameState {
    return committed(
      state,
      commandFrom(requireAction(buildGameViewModel(state, {}), `node.select:${nodeId}`)),
      `select ${nodeId} must commit`
    );
  }

  function collectReward(state: GameState, label: string): GameState {
    return committed(state, { type: 'node/collect-reward' }, `${label} must commit`);
  }

  function fightUntilResolved(state: GameState, script: readonly CombatAction[], label: string): GameState {
    let current = state;
    let turns = 0;
    while (current.phase === 'combat') {
      assert(turns < 32, `${label} must resolve within 32 turns`);
      const view = buildGameViewModel(current, {});
      const wanted = script[turns] ?? 'attack';
      const scripted = getActions(view).find((action) =>
        action.actionId === `combat.action:${wanted}` && action.enabled
      );
      const action = scripted ?? requireAction(view, 'combat.action:attack');
      assert(action.enabled, `${label} fallback attack must stay available`);
      current = committed(current, commandFrom(action), `${label} turn ${turns + 1} must commit`);
      turns += 1;
    }
    equal(current.phase, 'explore', `${label} must return to explore`);
    return current;
  }

  function guardUntilFailure(state: GameState): GameState {
    let current = state;
    let turns = 0;
    while (current.phase === 'combat') {
      assert(turns < 256, 'guard loop must reach result/failed within 256 turns');
      const guard = requireAction(buildGameViewModel(current, {}), 'combat.action:guard');
      assert(guard.enabled, 'guard must remain a legal combat action');
      // Each iteration dispatches a fresh command against the current state; state is never mutated.
      current = committed(current, commandFrom(guard), `guard turn ${turns + 1} must commit`);
      turns += 1;
    }
    equal(current.phase, 'result', 'guard loop must end in result');
    return current;
  }

  function resolveBlockingPendings(state: GameState): GameState {
    let current = state;
    for (let guard = 0; guard < 8; guard += 1) {
      const view = buildGameViewModel(current, {});
      const detail = view.sections[1].detail;
      if (detail.kind !== 'explore' || !detail.pending) return current;
      if (detail.pending.kind !== 'equipment-offer' && detail.pending.kind !== 'relic-draft') return current;
      const action = getActions(view).find((candidate) =>
        candidate.enabled
        && (candidate.actionId.startsWith('pending.equipment:') || candidate.actionId.startsWith('pending.relic:'))
        && !candidate.actionId.endsWith(':skip')
      );
      assert(action, `pending ${detail.pending.kind} must expose a resolution action`);
      current = committed(current, commandFrom(action), `resolve pending ${detail.pending.kind}`);
    }
    throw new Error('pending resolution did not converge');
  }

  function resultDetail(state: GameState): ResultDetailViewModel {
    const view = buildGameViewModel(state, {});
    equal(view.phase, 'result', 'result phase');
    const detail = view.sections[1].detail;
    assert(detail.kind === 'result', 'result detail');
    return detail;
  }

  function assertValidSettlement<C extends { readonly state: string }>(
    card: C | undefined,
    label: string
  ): asserts card is C & { readonly state: 'valid' } {
    assert(card !== undefined, `${label} must be present`);
    if (card.state !== 'valid') {
      const diagnostic = (card as { diagnostic?: unknown }).diagnostic;
      throw new Error(`${label} must be valid: ${String(diagnostic)}`);
    }
  }

  function assertInvalidSettlement(
    card: AnyResultSettlement | undefined,
    expectedCard: ResultSettlementCard,
    label: string
  ): void {
    assert(card !== undefined, `${label} must be present`);
    equal(card.state, 'invalid', `${label} must be invalid`);
    if (card.state === 'invalid') {
      equal(card.card, expectedCard, `${label} stable card identity`);
      assert(card.diagnostic.length > 0 && /[一-鿿]/.test(card.diagnostic), `${label} Chinese diagnostic`);
      assert(!/[a-zA-Z=]/.test(card.diagnostic), `${label} diagnostic leaks no raw token`);
    }
  }

  function bagItemTotal(bag: LootBag): number {
    return Object.values(bag.items).reduce((sum, count) => sum + count, 0);
  }

  function assertLootCardMatchesBag(card: ValidLootCard, bag: LootBag, mode: 'full' | 'half' | 'lost'): void {
    const itemTotal = bagItemTotal(bag);
    const equipmentNames = bag.equipmentIds.map((id) => EQUIPMENT[id].name);
    if (mode === 'full') {
      equal(card.retainedRewardPoints, bag.rewardPoints, 'exit retains all bag reward points');
      equal(card.retainedLingyun, bag.lingyun, 'exit retains all bag lingyun');
      equal(card.retainedItemCount, itemTotal, 'exit retains all bag items');
      equal(card.retainedEquipmentCount, bag.equipmentIds.length, 'exit retains all bag equipment');
      equal(card.retainedEquipmentNames.join(','), equipmentNames.join(','), 'exit retains bag equipment names');
      equal(card.lostRewardPoints, 0, 'exit loses no reward points');
      equal(card.lostLingyun, 0, 'exit loses no lingyun');
      equal(card.lostItemCount, 0, 'exit loses no items');
      equal(card.lostEquipmentCount, 0, 'exit loses no equipment');
      equal(card.lostEquipmentNames.length, 0, 'exit loses no equipment names');
    } else if (mode === 'half') {
      const retainedRewardPoints = Math.floor(bag.rewardPoints / 2);
      const retainedLingyun = Math.floor(bag.lingyun / 2);
      equal(card.retainedRewardPoints, retainedRewardPoints, 'secured retreat retains half reward points');
      equal(card.lostRewardPoints, bag.rewardPoints - retainedRewardPoints, 'secured retreat loses half reward points');
      equal(card.retainedLingyun, retainedLingyun, 'secured retreat retains half lingyun');
      equal(card.lostLingyun, bag.lingyun - retainedLingyun, 'secured retreat loses half lingyun');
      const retainedItemTotal = Object.values(bag.items).reduce((sum, count) => sum + Math.floor(count / 2), 0);
      equal(card.retainedItemCount, retainedItemTotal, 'secured retreat retains half items');
      equal(card.lostItemCount, itemTotal - retainedItemTotal, 'secured retreat loses half items');
      equal(card.retainedEquipmentCount, 0, 'secured retreat retains no equipment');
      equal(card.lostEquipmentCount, bag.equipmentIds.length, 'secured retreat loses all equipment');
      equal(card.lostEquipmentNames.join(','), equipmentNames.join(','), 'secured retreat loses equipment names');
    } else {
      equal(card.retainedRewardPoints, 0, 'unsecured loss retains no reward points');
      equal(card.retainedLingyun, 0, 'unsecured loss retains no lingyun');
      equal(card.retainedItemCount, 0, 'unsecured loss retains no items');
      equal(card.retainedEquipmentCount, 0, 'unsecured loss retains no equipment');
      equal(card.retainedEquipmentNames.length, 0, 'unsecured loss retains no equipment names');
      equal(card.lostRewardPoints, bag.rewardPoints, 'unsecured loss loses all reward points');
      equal(card.lostLingyun, bag.lingyun, 'unsecured loss loses all lingyun');
      equal(card.lostItemCount, itemTotal, 'unsecured loss loses all items');
      equal(card.lostEquipmentCount, bag.equipmentIds.length, 'unsecured loss loses all equipment');
      equal(card.lostEquipmentNames.join(','), equipmentNames.join(','), 'unsecured loss loses equipment names');
    }
  }

  const RAW_SETTLEMENT_TOKENS = [
    'outcome=',
    'succeeded',
    'successful_exit',
    'stable_portal',
    'forced_portal',
    'retreat',
    'failure',
    'failed',
    'acquired',
    'salvaged',
    'upgraded',
    'secured',
    'banked',
    'hunted',
    'breach',
    'standard',
    'imprint',
    'demon_tower_1',
    'out_of_order',
    'incomplete_exit',
    'cross_dungeon'
  ] as const;

  // Structural identifiers (objective id/kind, stable card identity) are not visible copy;
  // every other string in the seven cards must be Chinese with no raw domain token.
  function collectVisibleStrings(value: unknown, out: string[] = [], key?: string): string[] {
    if (key === 'id' || key === 'kind' || key === 'card') return out;
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) for (const child of value) collectVisibleStrings(child, out);
    else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) collectVisibleStrings(child, out, childKey);
    }
    return out;
  }

  function assertNoRawSettlementTokens(detail: ResultDetailViewModel, label: string): void {
    const cards: readonly unknown[] = [
      detail.lootSettlement,
      detail.equipmentRollSettlement,
      detail.protocolSettlement,
      detail.directiveSettlement,
      detail.routeContractSettlement,
      detail.pressureSettlement,
      detail.pursuitSettlement
    ];
    for (const value of collectVisibleStrings([...cards, detail.outcome])) {
      assert(!value.includes('='), `${label} visible text must not contain raw key/value tokens: ${value}`);
      for (const token of RAW_SETTLEMENT_TOKENS) {
        assert(!value.includes(token), `${label} visible text must not leak raw token ${token}: ${value}`);
      }
    }
  }

  function assertNonExitCleared(state: GameState, expected: number, label: string): void {
    const security = getRunLootSecurityStatus(state);
    equal(security.clearedNodeCount, expected, `${label} non-exit cleared count`);
  }

  // --- Flow 1: normal exit through the verified first-chapter route. ---
  function driveNormalExit(): FlowResult {
    let state = createInitialState();
    state = committed(state, { type: 'hub/buy-item', itemId: 'healing_pill' }, 'buy first healing pill');
    state = committed(state, { type: 'hub/buy-item', itemId: 'healing_pill' }, 'buy second healing pill');
    state = committed(state, {
      type: 'hub/configure-tactical-loadout',
      itemIds: ['healing_pill', 'dispel_talisman', 'gate_sigil']
    }, 'configure first-chapter tactical loadout');
    state = enterNormalRun(state);

    state = selectNode(state, 'fog_lesser_demon');
    state = fightUntilResolved(state, ['attack', 'attack', 'attack'], 'first monster');
    assert(state.run?.clearedNodeIds.includes('fog_lesser_demon'), 'first monster cleared');

    state = moveTo(state, 'blood_rune_trap');
    state = committed(
      state,
      commandFrom(requireAction(buildGameViewModel(state, {}), 'node.trap:blood_rune_trap:risk')),
      'blood rune risk must commit'
    );
    assert(state.run?.clearedNodeIds.includes('blood_rune_trap'), 'blood rune trap cleared');
    state = moveTo(state, 'fog_lesser_demon');
    state = moveTo(state, 'broken_sigil_reward');
    state = collectReward(state, 'broken sigil collect');

    state = moveTo(state, 'watch_post_cache');
    state = collectReward(state, 'watch post collect');
    state = resolveBlockingPendings(state);

    state = moveTo(state, 'broken_sigil_reward');
    state = moveTo(state, 'fog_lesser_demon');
    state = moveTo(state, 'blood_rune_trap');
    state = moveTo(state, 'cracked_portal');
    state = moveTo(state, 'sealed_cache');
    state = collectReward(state, 'sealed cache collect');

    state = moveTo(state, 'mist_herb_cache');
    state = collectReward(state, 'mist herb collect');

    state = moveTo(state, 'bone_lane_monster');
    state = selectNode(state, 'bone_lane_monster');
    state = fightUntilResolved(state, [
      'attack', 'attack', 'use_healing_pill',
      'attack', 'attack', 'use_healing_pill',
      'attack', 'attack'
    ], 'bone lane boss');
    assert(state.run?.clearedNodeIds.includes('bone_lane_monster'), 'boss cleared');

    state = resolveBlockingPendings(state);

    state = moveTo(state, 'tower_exit');
    const bag = state.run!.lootBag;
    state = committed(state, { type: 'run/resolve-exit' }, 'resolve exit must commit');
    equal(state.phase, 'result', 'exit reaches result');
    return { result: state, bag };
  }

  // --- Flow 2: retreat after clearing at least three non-exit nodes (loot secured). ---
  function driveRetreatSecured(): FlowResult {
    let state = enterNormalRun(createInitialState());
    state = selectNode(state, 'fog_lesser_demon');
    state = fightUntilResolved(state, ['attack', 'attack', 'attack'], 'first monster');
    state = moveTo(state, 'blood_rune_trap');
    state = committed(
      state,
      commandFrom(requireAction(buildGameViewModel(state, {}), 'node.trap:blood_rune_trap:risk')),
      'blood rune risk must commit'
    );
    state = moveTo(state, 'fog_lesser_demon');
    state = moveTo(state, 'broken_sigil_reward');
    state = collectReward(state, 'broken sigil collect');
    assertNonExitCleared(state, 3, 'secured retreat');
    const bag = state.run!.lootBag;
    state = committed(state, { type: 'run/retreat' }, 'retreat after three clears must commit');
    equal(state.phase, 'result', 'retreat reaches result');
    return { result: state, bag };
  }

  // --- Flow 3: retreat after clearing fewer than three non-exit nodes (loot unsecured). ---
  function driveRetreatUnsecured(): FlowResult {
    let state = enterNormalRun(createInitialState());
    state = selectNode(state, 'fog_lesser_demon');
    state = fightUntilResolved(state, ['attack', 'attack', 'attack'], 'first monster');
    assertNonExitCleared(state, 1, 'unsecured retreat');
    const bag = state.run!.lootBag;
    state = committed(state, { type: 'run/retreat' }, 'retreat after one clear must commit');
    equal(state.phase, 'result', 'retreat reaches result');
    return { result: state, bag };
  }

  // --- Flow 4: natural death by guarding the first monster until the core recycles the run. ---
  function driveFailure(): FlowResult {
    let state = enterNormalRun(createInitialState());
    state = selectNode(state, 'fog_lesser_demon');
    equal(state.phase, 'combat', 'first monster starts combat');
    const bag = state.run!.lootBag;
    state = guardUntilFailure(state);
    return { result: state, bag };
  }

  function assertFlowSettlementContract(
    flow: FlowResult,
    expected: Readonly<{
      outcome: string;
      lootMode: 'full' | 'half' | 'lost';
      pursuitReason: string;
      pressureTier?: string;
    }>
  ): ResultDetailViewModel {
    const detail = resultDetail(flow.result);
    equal(detail.outcome, expected.outcome, 'outcome Chinese readout');

    assertValidSettlement(detail.lootSettlement, 'loot');
    assertLootCardMatchesBag(detail.lootSettlement, flow.bag, expected.lootMode);

    assertValidSettlement(detail.directiveSettlement, 'directive');
    assert(
      ['未解锁', '进行中', '已完成', '失败'].includes(detail.directiveSettlement.statusLabel),
      'directive Chinese status label'
    );

    assertValidSettlement(detail.pursuitSettlement, 'pursuit');
    equal(detail.pursuitSettlement.name, '血阶监猎者', 'pursuit catalog name');
    equal(detail.pursuitSettlement.reasonLabel, expected.pursuitReason, 'pursuit Chinese reason');
    equal(detail.pursuitSettlement.rewarded, false, 'chapter-one pursuit is not rewarded');

    if (expected.pressureTier) {
      assertValidSettlement(detail.pressureSettlement, 'pressure');
      equal(detail.pressureSettlement.tierLabel, expected.pressureTier, 'pressure Chinese tier');
    } else {
      equal(detail.pressureSettlement, undefined, 'interrupted runs write no pressure settlement');
    }

    equal(detail.protocolSettlement, undefined, 'standard protocol writes no protocol settlement');
    // A no-contract entry may still discover a hidden route contract mid-run (seeded); if the
    // core settled one, the card must be valid with a catalog name.
    if (detail.routeContractSettlement) {
      assertValidSettlement(detail.routeContractSettlement, 'route contract');
      assert(detail.routeContractSettlement.contractName.length > 0, 'route contract Chinese name');
      assert(detail.routeContractSettlement.statusLabel.length > 0, 'route contract Chinese status');
    }
    equal(detail.equipmentRollSettlement, undefined, 'non-inferno run writes no equipment roll settlement');

    assertNoRawSettlementTokens(detail, 'result settlement');
    return detail;
  }

  const exitFlow = driveNormalExit();
  const exitDetail = assertFlowSettlementContract(exitFlow, {
    outcome: '稳定通关',
    lootMode: 'full',
    pursuitReason: '成功撤离',
    pressureTier: '追猎'
  });
  verifyActionContract(buildGameViewModel(exitFlow.result, {}));
  assert(getActions(buildGameViewModel(exitFlow.result, {})).length < 20, 'exit result actions under 20');
  JSON.parse(JSON.stringify(buildGameViewModel(exitFlow.result, {})));
  assert(Object.isFrozen(exitDetail.lootSettlement), 'loot settlement frozen');
  assert(Object.isFrozen(exitDetail.pursuitSettlement), 'pursuit settlement frozen');

  const securedFlow = driveRetreatSecured();
  const securedDetail = assertFlowSettlementContract(securedFlow, {
    outcome: '主动撤退',
    lootMode: 'half',
    pursuitReason: '主动撤退'
  });

  const unsecuredFlow = driveRetreatUnsecured();
  const unsecuredDetail = assertFlowSettlementContract(unsecuredFlow, {
    outcome: '主动撤退',
    lootMode: 'lost',
    pursuitReason: '主动撤退'
  });

  const failureFlow = driveFailure();
  const failureDetail = assertFlowSettlementContract(failureFlow, {
    outcome: '濒死回收',
    lootMode: 'lost',
    pursuitReason: '濒死回收'
  });

  // Loot solidification differential across the four flows.
  const exitLoot = exitDetail.lootSettlement;
  const securedLoot = securedDetail.lootSettlement;
  const unsecuredLoot = unsecuredDetail.lootSettlement;
  const failureLoot = failureDetail.lootSettlement;
  if (exitLoot?.state === 'valid' && securedLoot?.state === 'valid'
    && unsecuredLoot?.state === 'valid' && failureLoot?.state === 'valid') {
    assert(exitLoot.retainedRewardPoints > securedLoot.retainedRewardPoints, 'exit retains more than a secured retreat');
    assert(securedLoot.retainedRewardPoints > 0, 'secured retreat retains some reward points');
    equal(unsecuredLoot.retainedRewardPoints, 0, 'unsecured retreat retains nothing');
    equal(failureLoot.retainedRewardPoints, 0, 'failure retains nothing');
    equal(exitLoot.lostRewardPoints, 0, 'exit loses nothing');
    assert(securedLoot.lostRewardPoints > 0, 'secured retreat loses some reward points');
    assert(unsecuredLoot.lostRewardPoints > 0, 'unsecured retreat loses the bag');
    equal(failureLoot.lostRewardPoints, 0, 'failure loses nothing (bag was empty)');
  } else {
    throw new Error('all four loot cards must be valid for the differential assertion');
  }

  // --- Malformed clones: corrupt real settlement evidence, expect the invalid union. ---
  function cloneResultWithRunPatch(state: GameState, patch: Record<string, unknown>): GameState {
    const clone = JSON.parse(JSON.stringify(state)) as GameState;
    return { ...clone, run: { ...clone.run!, ...patch } };
  }

  const SETTLEMENT_PICKERS: Readonly<Record<ResultSettlementCard, (detail: ResultDetailViewModel) => AnyResultSettlement | undefined>> = {
    loot: (detail) => detail.lootSettlement,
    'equipment-roll': (detail) => detail.equipmentRollSettlement,
    protocol: (detail) => detail.protocolSettlement,
    directive: (detail) => detail.directiveSettlement,
    'route-contract': (detail) => detail.routeContractSettlement,
    pressure: (detail) => detail.pressureSettlement,
    pursuit: (detail) => detail.pursuitSettlement
  };

  function expectInvalidCard(base: GameState, patch: Record<string, unknown>, card: ResultSettlementCard): void {
    const detail = resultDetail(cloneResultWithRunPatch(base, patch));
    assertInvalidSettlement(SETTLEMENT_PICKERS[card](detail), card, `${card} malformed`);
  }

  const realLoot = exitFlow.result.run!.lastLootSettlement!;
  const realPressure = exitFlow.result.run!.lastPressureSettlement!;
  const realPursuit = exitFlow.result.run!.lastPursuitSettlement!;

  expectInvalidCard(exitFlow.result, { lastLootSettlement: { ...realLoot, retained: { ...realLoot.retained, rewardPoints: NaN } } }, 'loot');
  expectInvalidCard(exitFlow.result, { lastLootSettlement: { ...realLoot, lost: { ...realLoot.lost, rewardPoints: Infinity } } }, 'loot');
  expectInvalidCard(exitFlow.result, { lastLootSettlement: { ...realLoot, retained: { ...realLoot.retained, lingyun: -1 } } }, 'loot');
  expectInvalidCard(exitFlow.result, { lastLootSettlement: { ...realLoot, retained: { ...realLoot.retained, items: { unknown_item: 1 } } } }, 'loot');
  expectInvalidCard(exitFlow.result, { lastLootSettlement: { ...realLoot, retained: { ...realLoot.retained, equipmentIds: ['unknown_equipment'] } } }, 'loot');
  expectInvalidCard(exitFlow.result, { lastLootSettlement: { ...realLoot, retained: undefined } }, 'loot');
  expectInvalidCard(exitFlow.result, { lastLootSettlement: { ...realLoot, retained: { ...realLoot.retained, rewardPoints: 1.5 } } }, 'loot');

  const rollFixture = {
    equipmentId: 'armor_piercing_sword',
    roll: createEquipmentRoll({ equipmentId: 'armor_piercing_sword', slot: 'weapon', base: {}, sourceTier: 1, seed: 42 }),
    outcome: 'acquired',
    salvageRewardPoints: 0
  };
  expectInvalidCard(exitFlow.result, { lastEquipmentRollSettlement: { ...rollFixture, equipmentId: 'unknown_equipment' } }, 'equipment-roll');
  expectInvalidCard(exitFlow.result, { lastEquipmentRollSettlement: { ...rollFixture, outcome: 'melted' } }, 'equipment-roll');
  expectInvalidCard(exitFlow.result, { lastEquipmentRollSettlement: { ...rollFixture, salvageRewardPoints: -1 } }, 'equipment-roll');
  expectInvalidCard(exitFlow.result, { lastEquipmentRollSettlement: { ...rollFixture, roll: null } }, 'equipment-roll');
  expectInvalidCard(exitFlow.result, { lastEquipmentRollSettlement: { ...rollFixture, outcome: 'acquired', salvageRewardPoints: 5 } }, 'equipment-roll');

  const protocolFixture = {
    protocol: { id: 'standard', rulesVersion: 1 },
    status: 'succeeded',
    bossDefeated: true,
    baseRewardPoints: 200,
    protocolRewardPoints: 100,
    rewardPointBonus: 50,
    cycleImprintGranted: false
  };
  expectInvalidCard(exitFlow.result, { lastProtocolSettlement: { ...protocolFixture, protocol: { id: 'eternal', rulesVersion: 1 } } }, 'protocol');
  expectInvalidCard(exitFlow.result, { lastProtocolSettlement: { ...protocolFixture, status: 'crashed' } }, 'protocol');
  expectInvalidCard(exitFlow.result, { lastProtocolSettlement: { ...protocolFixture, baseRewardPoints: NaN } }, 'protocol');
  expectInvalidCard(exitFlow.result, { lastProtocolSettlement: { ...protocolFixture, materialReward: { itemId: 'unknown_item', amount: 1 } } }, 'protocol');
  expectInvalidCard(exitFlow.result, { lastProtocolSettlement: { ...protocolFixture, status: 'failed', rewardPointBonus: 10 } }, 'protocol');

  const contract = listRouteContracts('demon_tower_1')[0]!;
  const contractState = {
    rulesVersion: 1,
    contractId: contract.id,
    dungeonId: 'demon_tower_1',
    completedTargetCount: 2,
    status: 'banked'
  };
  const contractFixture = { state: contractState, rewardPoints: contract.rewardPoints, rewarded: true };
  expectInvalidCard(exitFlow.result, { lastRouteContractSettlement: { ...contractFixture, state: { ...contractState, contractId: 'unknown_contract' } } }, 'route-contract');
  expectInvalidCard(exitFlow.result, { lastRouteContractSettlement: { ...contractFixture, state: { ...contractState, status: 'crashed' } } }, 'route-contract');
  expectInvalidCard(exitFlow.result, { lastRouteContractSettlement: { ...contractFixture, state: { ...contractState, completedTargetCount: 5 } } }, 'route-contract');
  expectInvalidCard(exitFlow.result, { lastRouteContractSettlement: { ...contractFixture, rewardPoints: -1 } }, 'route-contract');
  expectInvalidCard(exitFlow.result, { lastRouteContractSettlement: { ...contractFixture, rewardPoints: 0 } }, 'route-contract');
  expectInvalidCard(exitFlow.result, { lastRouteContractSettlement: { state: { ...contractState, status: 'lost', reason: 'unknown_reason' }, rewardPoints: 0, rewarded: false } }, 'route-contract');

  expectInvalidCard(exitFlow.result, { lastPressureSettlement: { ...realPressure, state: null } }, 'pressure');
  expectInvalidCard(exitFlow.result, { lastPressureSettlement: { ...realPressure, state: { rulesVersion: 1, clearedNodeCount: -1 } } }, 'pressure');
  expectInvalidCard(exitFlow.result, { lastPressureSettlement: { ...realPressure, tier: 'calm' } }, 'pressure');
  expectInvalidCard(exitFlow.result, { lastPressureSettlement: { ...realPressure, rewardPointBonus: NaN } }, 'pressure');

  expectInvalidCard(exitFlow.result, { lastPursuitSettlement: { ...realPursuit, state: { ...realPursuit.state, dungeonId: 'unknown_dungeon' } } }, 'pursuit');
  expectInvalidCard(exitFlow.result, { lastPursuitSettlement: { ...realPursuit, reason: 'teleported' } }, 'pursuit');
  expectInvalidCard(exitFlow.result, { lastPursuitSettlement: { ...realPursuit, materialId: 'wrong_item' } }, 'pursuit');
  expectInvalidCard(exitFlow.result, { lastPursuitSettlement: { ...realPursuit, rewarded: true, reason: 'retreat' } }, 'pursuit');
  expectInvalidCard(exitFlow.result, { lastPursuitSettlement: { ...realPursuit, state: { ...realPursuit.state, status: 'crashed' } } }, 'pursuit');

  // Directive: an unknown dungeon makes the core selector throw; the card fails closed while
  // the other cards stay valid.
  const directiveBroken = resultDetail(cloneResultWithRunPatch(exitFlow.result, { dungeonId: 'unknown_dungeon' }));
  assertInvalidSettlement(directiveBroken.directiveSettlement, 'directive', 'directive unknown dungeon');
  assertValidSettlement(directiveBroken.lootSettlement, 'loot survives directive corruption');
  assertValidSettlement(directiveBroken.pursuitSettlement, 'pursuit survives directive corruption');

  // --- Well-formed fixtures for the three cards the four standard flows never produce. ---
  const rollFixtureDetail = resultDetail(cloneResultWithRunPatch(exitFlow.result, { lastEquipmentRollSettlement: rollFixture }));
  assertValidSettlement(rollFixtureDetail.equipmentRollSettlement, 'equipment roll fixture');
  if (rollFixtureDetail.equipmentRollSettlement?.state === 'valid') {
    equal(rollFixtureDetail.equipmentRollSettlement.equipmentName, EQUIPMENT.armor_piercing_sword.name, 'roll fixture catalog name');
    equal(rollFixtureDetail.equipmentRollSettlement.outcomeLabel, '获得', 'roll fixture Chinese outcome');
  }

  const protocolFixtureDetail = resultDetail(cloneResultWithRunPatch(exitFlow.result, { lastProtocolSettlement: protocolFixture }));
  assertValidSettlement(protocolFixtureDetail.protocolSettlement, 'protocol fixture');
  if (protocolFixtureDetail.protocolSettlement?.state === 'valid') {
    equal(protocolFixtureDetail.protocolSettlement.protocolName, '标准探索', 'protocol fixture catalog name');
    equal(protocolFixtureDetail.protocolSettlement.statusLabel, '成功', 'protocol fixture Chinese status');
  }

  const contractFixtureDetail = resultDetail(cloneResultWithRunPatch(exitFlow.result, { lastRouteContractSettlement: contractFixture }));
  assertValidSettlement(contractFixtureDetail.routeContractSettlement, 'route contract fixture');
  if (contractFixtureDetail.routeContractSettlement?.state === 'valid') {
    equal(contractFixtureDetail.routeContractSettlement.contractName, contract.name, 'contract fixture catalog name');
    equal(contractFixtureDetail.routeContractSettlement.statusLabel, '已入账', 'contract fixture Chinese status');
    equal(contractFixtureDetail.routeContractSettlement.rewarded, true, 'contract fixture rewarded');
  }

  // --- Deterministic fuzz: random corruptions of valid settlement evidence always fail closed. ---
  function corruptRandomly(value: unknown, random: () => number, depth = 0): unknown {
    if (Array.isArray(value)) {
      if (value.length === 0 || depth > 3 || random() < 0.3) return ['unknown_corrupted'];
      const index = Math.floor(random() * value.length);
      return value.map((item, i) => (i === index ? corruptRandomly(item, random, depth + 1) : item));
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0 || depth > 3) return { corrupted: true };
      const [key] = entries[Math.floor(random() * entries.length)]!;
      const result: Record<string, unknown> = { ...(value as Record<string, unknown>) };
      const leaf = result[key];
      const roll = random();
      if (typeof leaf === 'number') {
        result[key] = roll < 0.4 ? NaN : roll < 0.7 ? -1 : Infinity;
      } else if (typeof leaf === 'string') {
        result[key] = 'unknown_corrupted_value';
      } else if (leaf === null || leaf === undefined) {
        result[key] = NaN;
      } else if (roll < 0.3) {
        result[key] = null;
      } else if (roll < 0.6) {
        delete result[key];
      } else {
        result[key] = corruptRandomly(leaf, random, depth + 1);
      }
      return result;
    }
    if (typeof value === 'number') return NaN;
    if (typeof value === 'string') return 'unknown_corrupted_value';
    return null;
  }

  let fuzzSeed = 0x1234_abcd;
  const fuzzRandom = () => {
    fuzzSeed = (Math.imul(fuzzSeed, 1664525) + 1013904223) >>> 0;
    return fuzzSeed / 0x1_0000_0000;
  };
  const fuzzFields: ReadonlyArray<{ key: string; card: ResultSettlementCard; base: () => unknown }> = [
    { key: 'lastLootSettlement', card: 'loot', base: () => exitFlow.result.run!.lastLootSettlement },
    { key: 'lastEquipmentRollSettlement', card: 'equipment-roll', base: () => rollFixture },
    { key: 'lastProtocolSettlement', card: 'protocol', base: () => protocolFixture },
    { key: 'lastRouteContractSettlement', card: 'route-contract', base: () => contractFixture },
    { key: 'lastPressureSettlement', card: 'pressure', base: () => exitFlow.result.run!.lastPressureSettlement },
    { key: 'lastPursuitSettlement', card: 'pursuit', base: () => exitFlow.result.run!.lastPursuitSettlement }
  ];
  for (let iteration = 0; iteration < 96; iteration += 1) {
    const field = fuzzFields[Math.floor(fuzzRandom() * fuzzFields.length)]!;
    const corrupted = corruptRandomly(field.base(), fuzzRandom);
    const detail = resultDetail(cloneResultWithRunPatch(exitFlow.result, { [field.key]: corrupted }));
    assertInvalidSettlement(SETTLEMENT_PICKERS[field.card](detail), field.card, `fuzz ${field.card} #${iteration}`);
  }
}

verifyHubAndHelp();
verifyEquipmentChapterRecipeSemantics();
verifyEquipmentCommission();
verifyEquipmentMemoryProjection();
verifyEntryBuildSelection();
verifyHubPanelsAndGrowthCommands();
verifyMapFiveStatesAndMovement();
verifySoulRechargeActivation();
verifyPendingAndExitGuard();
verifyDefaultPendingTrapProjection();
const combat = verifyCombatAndSingleAdvance();
verifyBossAndResult(combat);
verifyAbnormalVisualFallbacks();
verifyTokensAndJson();
verifyChapterDecisionProjection();
verifyCombatChapterContext();
verifyResultSettlement();
