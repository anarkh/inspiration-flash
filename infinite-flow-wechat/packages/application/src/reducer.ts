import {
  DUNGEONS,
  activateBloodline,
  activateCompanion,
  activateCurrentEquipmentSoulSkillRecharge,
  activateMethod,
  activateOwnedEquipmentMemory,
  activatePet,
  attuneEquipment,
  buyEquipment,
  buyItem,
  buyPet,
  cancelCurrentEquipmentSoulSkillRecharge,
  capturePet,
  claimTaskReward,
  collectReward,
  configureRunRelicPreparation,
  configureTacticalLoadout,
  createInitialState,
  enterDungeon,
  equipEquipment,
  getBossSealStatus,
  getCurrentLegalAdjacentTargetIds,
  getNodeDepartureBlock,
  handleTrap,
  learnMethod,
  moveToNode,
  performCombatAction,
  prepareEquipmentHunt,
  prepareEquipmentMemoryHunt,
  recallEquipmentCommission,
  recoverAtHub,
  recruitCompanion,
  resolveAuctionLot,
  resolveCausalLedger,
  resolveCurrentBroadcastRelay,
  resolveCurrentEquipmentSoulSkillRecharge,
  resolveCurrentEscortCheckpoint,
  resolveCurrentVerdictChoice,
  resolveDungeonEvent,
  resolveEntropyHeading,
  resolveEquipmentLoot,
  resolveExit,
  resolveFieldSurvey,
  resolveGenesisSplice,
  resolveMirrorCityPhase,
  resolveRedactionClause,
  resolveRetreat,
  resolveRunRelicArchive,
  resolveRunRelicDraft,
  returnToHub,
  selectCombatReplayRoute,
  selectNode,
  selectPanopticonRoute,
  startEquipmentCommission,
  temperEquipment,
  unlockBloodline,
  upgradeBloodline,
  upgradeCompanion,
  upgradeEquipment,
  upgradeMethod,
  upgradePet,
  useBloodlineSurge,
  useCompanionAssist,
  useEquipmentSoulSkill,
  useMethodTechnique,
  usePortal,
  type DungeonId,
  type GameState,
  type Phase
} from '@infinite-flow/core';
import {
  guardGameCommandPhase,
  validateGameCommand,
  type GameCommand,
  type GameCommandType
} from './commands.js';

export type DeepReadonly<T> = T extends (...arguments_: never[]) => unknown
  ? T
  : T extends readonly (infer Element)[]
    ? readonly DeepReadonly<Element>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ReadonlyGameState = DeepReadonly<GameState>;

export type GameCommandRejectionCode =
  | 'invalid-command'
  | 'invalid-phase'
  | 'invalid-seed-bundle'
  | 'missing-run'
  | 'missing-combat'
  | 'departure-blocked'
  | 'illegal-move'
  | 'wrong-node'
  | 'already-resolved'
  | 'domain-rejected';

export type GameCommandRejection = Readonly<{
  code: GameCommandRejectionCode;
  commandType: string;
  message: string;
  actualPhase: Phase;
  allowedPhases?: readonly Phase[];
}>;

export type GameDomainEvent =
  | Readonly<{
      type: 'command.applied';
      commandType: GameCommandType;
      fromPhase: Phase;
      toPhase: Phase;
    }>
  | Readonly<{ type: 'phase.changed'; from: Phase; to: Phase }>
  | Readonly<{
      type: 'run.entered';
      dungeonId: DungeonId;
      protocolId: 'standard' | 'imprint' | 'deep';
      hiddenTaskSeed: number;
      infernoMapSeed?: number;
    }>
  | Readonly<{ type: 'node.moved'; fromNodeId: string; toNodeId: string }>
  | Readonly<{ type: 'combat.started'; nodeId: string; monsterId: string }>
  | Readonly<{
      type: 'combat.turn-resolved';
      action: string;
      turnBefore: number;
      turnAfter: number;
    }>
  | Readonly<{ type: 'boss.awakened'; nodeId: string }>
  | Readonly<{ type: 'combat.finished'; nodeId: string; result: 'victory' | 'escaped' | 'failed' }>
  | Readonly<{ type: 'run.settled'; dungeonId: DungeonId; outcome?: string }>
  | Readonly<{ type: 'relic.archive-resolved'; relicId?: string }>
  | Readonly<{ type: 'hub.returned' }>;

export type CommittedGameCommandOutcome = Readonly<{
  status: 'committed';
  commandType: GameCommandType;
  fromPhase: Phase;
  toPhase: Phase;
  changed: true;
}>;

export type RejectedGameCommandOutcome = Readonly<{
  status: 'rejected';
  commandType: string;
  fromPhase: Phase;
  toPhase: Phase;
  changed: false;
  rejectionCode: GameCommandRejectionCode;
}>;

export type GameCommandOutcome = CommittedGameCommandOutcome | RejectedGameCommandOutcome;

export type GameCommandReducerResult =
  | Readonly<{
      status: 'committed';
      state: GameState;
      events: readonly GameDomainEvent[];
      outcome: CommittedGameCommandOutcome;
    }>
  | Readonly<{
      status: 'rejected';
      state: ReadonlyGameState;
      events: readonly [];
      reason: GameCommandRejection;
      outcome: RejectedGameCommandOutcome;
    }>;

function reject(
  state: ReadonlyGameState,
  commandType: string,
  code: GameCommandRejectionCode,
  message: string,
  allowedPhases?: readonly Phase[]
): GameCommandReducerResult {
  const reason: GameCommandRejection = {
    code,
    commandType,
    message,
    actualPhase: state.phase,
    ...(allowedPhases === undefined ? {} : { allowedPhases })
  };
  return {
    status: 'rejected',
    state,
    events: [],
    reason,
    outcome: {
      status: 'rejected',
      commandType,
      fromPhase: state.phase,
      toPhase: state.phase,
      changed: false,
      rejectionCode: code
    }
  };
}

function asMutableDomainState(state: ReadonlyGameState): GameState {
  // Core transitions are immutable. This narrows the structural readonly view without cloning.
  return state as GameState;
}

function domainProjection(state: GameState): unknown {
  const { log: _log, combat, ...rest } = state;
  if (!combat) return rest;
  const { log: _combatLog, ...combatRest } = combat;
  return { ...rest, combat: combatRest };
}

function hasDomainChange(before: GameState, after: GameState): boolean {
  return JSON.stringify(domainProjection(before)) !== JSON.stringify(domainProjection(after));
}

function latestDomainMessage(before: GameState, after: GameState): string {
  return after.log[0] !== before.log[0]
    ? after.log[0] ?? 'The domain rejected this command.'
    : 'The command did not produce a domain transition.';
}

function validateEntrySeeds(command: Extract<GameCommand, { type: 'run/enter' }>): string | undefined {
  const { hiddenTaskSeed, infernoMapSeed } = command.seeds;
  const validSeed = (value: number): boolean =>
    Number.isInteger(value) && value >= 1 && value <= 0xffff_ffff;

  if (command.seeds.rulesVersion !== 1 || !validSeed(hiddenTaskSeed)) {
    return 'Entry requires a persisted positive uint32 hidden-task seed using seed rules v1.';
  }
  if (command.protocolId === 'deep') {
    if (!Number.isSafeInteger(command.infernoTier) || (command.infernoTier ?? 0) < 1) {
      return 'Deep entry requires an explicit positive inferno tier.';
    }
    if (infernoMapSeed === undefined || !validSeed(infernoMapSeed)) {
      return 'Deep entry requires a persisted positive uint32 inferno-map seed.';
    }
    return undefined;
  }
  if (command.infernoTier !== undefined || infernoMapSeed !== undefined) {
    return 'Inferno tier and map seed are only valid for deep entry.';
  }
  return undefined;
}

function preflightCommand(state: GameState, command: GameCommand): GameCommandReducerResult | undefined {
  if (command.type === 'run/enter') {
    const seedIssue = validateEntrySeeds(command);
    if (seedIssue) return reject(state, command.type, 'invalid-seed-bundle', seedIssue);
  }

  if (command.type === 'run/move') {
    if (!state.run) return reject(state, command.type, 'missing-run', 'No active dungeon run exists.');
    const departureBlock = getNodeDepartureBlock(state);
    if (departureBlock) {
      return reject(state, command.type, 'departure-blocked', departureBlock.message);
    }
    const legalTargetIds = getCurrentLegalAdjacentTargetIds(state);
    if (!legalTargetIds.includes(command.nodeId)) {
      return reject(
        state,
        command.type,
        'illegal-move',
        `${command.nodeId} is not a legal adjacent destination from ${state.run.currentNodeId}.`
      );
    }
  }

  if (command.type === 'run/select-node') {
    if (!state.run) return reject(state, command.type, 'missing-run', 'No active dungeon run exists.');
    if (state.run.currentNodeId !== command.nodeId) {
      return reject(state, command.type, 'wrong-node', 'Only the current node can be selected.');
    }
    if (state.run.clearedNodeIds.includes(command.nodeId)) {
      return reject(state, command.type, 'already-resolved', 'The current node is already cleared.');
    }
  }

  if (command.type.startsWith('combat/') && !state.combat) {
    return reject(state, command.type, 'missing-combat', 'No active combat exists.');
  }

  if (command.type === 'run/resolve-exit') {
    if (!state.run) return reject(state, command.type, 'missing-run', 'No active dungeon run exists.');
    const dungeon = DUNGEONS[state.run.dungeonId];
    const node = dungeon.nodes.find((candidate) => candidate.id === state.run?.currentNodeId);
    if (node?.type !== 'exit') {
      return reject(state, command.type, 'wrong-node', 'The current node is not an exit.');
    }
    if (state.run.clearedNodeIds.includes(node.id)) {
      return reject(state, command.type, 'already-resolved', 'This exit has already been settled.');
    }
    if (state.run.pendingEquipmentOffer) {
      return reject(state, command.type, 'departure-blocked', 'Resolve the pending equipment offer first.');
    }
    if (state.run.soulSkillState?.pendingRecharge) {
      return reject(state, command.type, 'departure-blocked', 'Resolve or cancel the pending soul recharge first.');
    }
    const bossSeal = getBossSealStatus(state);
    if (bossSeal && !bossSeal.cleared) {
      return reject(state, command.type, 'departure-blocked', bossSeal.requirementText);
    }
  }

  if (command.type === 'result/archive-relic') {
    if (!state.run) return reject(state, command.type, 'missing-run', 'No settled run exists.');
    if (state.run.lastRelicSettlement?.status !== 'pending') {
      return reject(state, command.type, 'already-resolved', 'No pending relic archive exists.');
    }
  }

  if (command.type === 'result/return-hub' && state.run?.lastRelicSettlement?.status === 'pending') {
    return reject(state, command.type, 'departure-blocked', 'Resolve or skip relic archival first.');
  }

  return undefined;
}

function applyDomainCommand(state: GameState, command: GameCommand): GameState {
  switch (command.type) {
    case 'game/new':
      return createInitialState();
    case 'hub/recover':
      return recoverAtHub(state);
    case 'hub/configure-tactical-loadout':
      return configureTacticalLoadout(state, command.itemIds);
    case 'hub/configure-relic':
      return configureRunRelicPreparation(state, command.frame, command.seedRelicId);
    case 'hub/prepare-equipment-hunt':
      return prepareEquipmentHunt(state, command.dungeonId, command.equipmentId);
    case 'hub/prepare-equipment-memory-hunt':
      return prepareEquipmentMemoryHunt(state, command.dungeonId, command.equipmentId);
    case 'hub/activate-equipment-memory':
      return activateOwnedEquipmentMemory(state, command.equipmentId, command.memoryId);
    case 'hub/buy-item':
      return buyItem(state, command.itemId);
    case 'hub/buy-equipment':
      return buyEquipment(state, command.equipmentId, command.sourceDungeonId);
    case 'hub/equip-equipment':
      return equipEquipment(state, command.equipmentId);
    case 'hub/upgrade-equipment':
      return upgradeEquipment(state, command.equipmentId);
    case 'hub/attune-equipment':
      return attuneEquipment(state, command.equipmentId, command.attunementId);
    case 'hub/temper-equipment':
      return temperEquipment(state, command.equipmentId);
    case 'hub/buy-pet':
      return buyPet(state, command.petId);
    case 'hub/upgrade-pet':
      return upgradePet!(state, command.petId);
    case 'hub/activate-pet':
      return activatePet(state, command.petId);
    case 'hub/learn-method':
      return learnMethod(state, command.methodId);
    case 'hub/upgrade-method':
      return upgradeMethod(state, command.methodId);
    case 'hub/activate-method':
      return activateMethod(state, command.methodId);
    case 'hub/unlock-bloodline':
      return unlockBloodline(state, command.bloodlineId);
    case 'hub/upgrade-bloodline':
      return upgradeBloodline(state, command.bloodlineId);
    case 'hub/activate-bloodline':
      return activateBloodline(state, command.bloodlineId);
    case 'hub/recruit-companion':
      return recruitCompanion(state, command.companionId);
    case 'hub/upgrade-companion':
      return upgradeCompanion(state, command.companionId);
    case 'hub/activate-companion':
      return activateCompanion(state, command.companionId);
    case 'hub/start-equipment-commission':
      return startEquipmentCommission(state, command.equipmentIds, command.targetMaterialId);
    case 'hub/recall-equipment-commission':
      return recallEquipmentCommission(state);
    case 'hub/claim-task':
      return claimTaskReward(state, command.taskId);
    case 'run/enter':
      return enterDungeon(
        state,
        command.dungeonId,
        command.protocolId,
        command.routeContractId,
        {
          flowVersion: 2,
          hiddenTaskSeed: command.seeds.hiddenTaskSeed,
          ...(command.infernoTier === undefined ? {} : { infernoTier: command.infernoTier }),
          ...(command.seeds.infernoMapSeed === undefined
            ? {}
            : { infernoMapSeed: command.seeds.infernoMapSeed })
        }
      );
    case 'run/move':
      return moveToNode(state, command.nodeId);
    case 'run/select-node':
      return selectNode(state, command.nodeId);
    case 'node/handle-trap':
      return handleTrap(state, command.choice);
    case 'node/use-portal':
      return usePortal(state, command.choice);
    case 'node/collect-reward':
      return collectReward(state);
    case 'node/resolve-event':
      return resolveDungeonEvent(state, command.eventId, command.optionId);
    case 'node/resolve-field-survey':
      return resolveFieldSurvey(state, command.optionId);
    case 'node/resolve-equipment-loot':
      return resolveEquipmentLoot(state, command.equipmentId);
    case 'node/resolve-relic-draft':
      return command.draftId === undefined
        ? resolveRunRelicDraft(state, command.relicId)
        : resolveRunRelicDraft(state, command.draftId, command.relicId);
    case 'node/activate-soul-recharge':
      return activateCurrentEquipmentSoulSkillRecharge(state);
    case 'node/resolve-soul-recharge':
      return resolveCurrentEquipmentSoulSkillRecharge(state, command.skillId);
    case 'node/cancel-soul-recharge':
      return cancelCurrentEquipmentSoulSkillRecharge(state);
    case 'node/use-soul-skill':
      return useEquipmentSoulSkill(state, command.skillId, {
        ...(command.targetNodeId === undefined ? {} : { targetNodeId: command.targetNodeId }),
        ...(command.portalChoice === undefined ? {} : { portalChoice: command.portalChoice }),
        ...(command.itemId === undefined ? {} : { itemId: command.itemId })
      });
    case 'law/resolve-causal-ledger':
      return resolveCausalLedger(state, command.choice);
    case 'law/resolve-entropy-heading':
      return resolveEntropyHeading(state, command.choice);
    case 'law/resolve-mirror-city-phase':
      return resolveMirrorCityPhase(state, command.phase);
    case 'law/resolve-redaction-clause':
      return resolveRedactionClause(state, command.choice);
    case 'law/resolve-auction-lot':
      return resolveAuctionLot(state, command.choice);
    case 'law/resolve-genesis-splice':
      return resolveGenesisSplice(state, command.gene);
    case 'law/resolve-broadcast-relay':
      return resolveCurrentBroadcastRelay(state, command.choice);
    case 'law/resolve-escort-checkpoint':
      return resolveCurrentEscortCheckpoint(state, command.choice);
    case 'law/resolve-verdict':
      return resolveCurrentVerdictChoice(state, command.suspect);
    case 'law/select-combat-replay-route':
      return selectCombatReplayRoute(state, command.route);
    case 'law/select-panopticon-route':
      return selectPanopticonRoute(state, command.route);
    case 'combat/act':
      return performCombatAction(state, command.action);
    case 'combat/capture':
      return capturePet(state, command.petId);
    case 'combat/use-method-technique':
      return useMethodTechnique(state, command.methodId);
    case 'combat/use-companion-assist':
      return useCompanionAssist(state);
    case 'combat/use-bloodline-surge':
      return useBloodlineSurge(state);
    case 'run/retreat':
      return resolveRetreat(state);
    case 'run/resolve-exit':
      return resolveExit(state);
    case 'result/archive-relic':
      return resolveRunRelicArchive(state, command.relicId);
    case 'result/return-hub':
      return returnToHub(state);
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}

function deriveEvents(before: GameState, after: GameState, command: GameCommand): GameDomainEvent[] {
  const events: GameDomainEvent[] = [{
    type: 'command.applied',
    commandType: command.type,
    fromPhase: before.phase,
    toPhase: after.phase
  }];

  if (before.phase !== after.phase) {
    events.push({ type: 'phase.changed', from: before.phase, to: after.phase });
  }

  if (command.type === 'run/enter' && after.run) {
    events.push({
      type: 'run.entered',
      dungeonId: after.run.dungeonId,
      protocolId: command.protocolId,
      hiddenTaskSeed: command.seeds.hiddenTaskSeed,
      ...(command.seeds.infernoMapSeed === undefined
        ? {}
        : { infernoMapSeed: command.seeds.infernoMapSeed })
    });
  }

  if (before.run && after.run && before.run.currentNodeId !== after.run.currentNodeId) {
    events.push({
      type: 'node.moved',
      fromNodeId: before.run.currentNodeId,
      toNodeId: after.run.currentNodeId
    });
  }

  if (!before.combat && after.combat) {
    events.push({
      type: 'combat.started',
      nodeId: after.combat.nodeId,
      monsterId: after.combat.monsterId
    });
  }

  if (command.type === 'combat/act' && before.combat) {
    events.push({
      type: 'combat.turn-resolved',
      action: command.action,
      turnBefore: before.combat.turn,
      turnAfter: after.combat?.turn ?? before.combat.turn + 1
    });
  }

  if (before.combat?.bossPhase === 'sealed' && after.combat?.bossPhase === 'awakened') {
    events.push({ type: 'boss.awakened', nodeId: after.combat.nodeId });
  }

  if (before.combat && !after.combat) {
    const defeated = after.run?.clearedNodeIds.includes(before.combat.nodeId) === true;
    const escaped = command.type === 'combat/act' && command.action === 'escape';
    events.push({
      type: 'combat.finished',
      nodeId: before.combat.nodeId,
      result: defeated ? 'victory' : escaped ? 'escaped' : 'failed'
    });
  }

  if (before.phase !== 'result' && after.phase === 'result' && after.run) {
    events.push({
      type: 'run.settled',
      dungeonId: after.run.dungeonId,
      ...(after.lastOutcome === undefined ? {} : { outcome: after.lastOutcome })
    });
  }

  if (command.type === 'result/archive-relic') {
    events.push({
      type: 'relic.archive-resolved',
      ...(command.relicId === undefined ? {} : { relicId: command.relicId })
    });
  }

  if (command.type === 'result/return-hub') events.push({ type: 'hub.returned' });

  return events;
}

/**
 * Pure command reducer. It has no platform ports and never obtains seeds implicitly.
 * Rejections preserve the exact input state reference so GameSession can retain it verbatim.
 */
export function reduceGameCommand(
  readonlyState: ReadonlyGameState,
  input: GameCommand
): GameCommandReducerResult {
  const validation = validateGameCommand(input);
  if (!validation.ok) {
    return reject(
      readonlyState,
      validation.reason.commandType ?? 'unknown',
      'invalid-command',
      validation.reason.message
    );
  }
  const command = validation.value;
  const phaseGuard = guardGameCommandPhase(readonlyState, command);
  if (!phaseGuard.allowed) {
    return reject(
      readonlyState,
      command.type,
      'invalid-phase',
      `${command.type} is not allowed during ${phaseGuard.actualPhase}.`,
      phaseGuard.allowedPhases
    );
  }

  const state = asMutableDomainState(readonlyState);
  const preflight = preflightCommand(state, command);
  if (preflight) return preflight;

  let nextState: GameState;
  try {
    nextState = applyDomainCommand(state, command);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The domain transition threw an unknown error.';
    return reject(readonlyState, command.type, 'domain-rejected', message);
  }

  const changed = command.type === 'game/new' || hasDomainChange(state, nextState);
  if (!changed) {
    return reject(
      readonlyState,
      command.type,
      'domain-rejected',
      latestDomainMessage(state, nextState)
    );
  }

  const outcome: CommittedGameCommandOutcome = {
    status: 'committed',
    commandType: command.type,
    fromPhase: state.phase,
    toPhase: nextState.phase,
    changed: true
  };
  return {
    status: 'committed',
    state: nextState,
    events: deriveEvents(state, nextState, command),
    outcome
  };
}
