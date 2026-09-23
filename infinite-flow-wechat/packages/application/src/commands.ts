import type {
  BloodlineId,
  CausalLedgerChoice,
  CombatAction,
  CompanionId,
  DungeonId,
  EntropyHeadingChoice,
  EquipmentId,
  EscortCheckpointChoice,
  FalseTestimonySuspect,
  GameState,
  GenesisGene,
  ItemId,
  MethodId,
  MirrorCityPhase,
  PanopticonRoute,
  PetId,
  Phase,
  PortalChoice,
  RedactionChoice,
  TrapChoice
} from '@infinite-flow/core';
import type { EquipmentAttunementId } from '@infinite-flow/core/equipment-system';
import type { EquipmentMemoryId } from '@infinite-flow/core/equipment-memory-hunts';
import type { EquipmentSoulSkillId } from '@infinite-flow/core/equipment-soul-skills';
import type {
  AuctionLotChoice,
  BroadcastRelayChoice,
  CombatReplayRoute
} from '@infinite-flow/core/dungeon-laws';
import type { RunProtocolId } from '@infinite-flow/core/run-protocols';
import type { RunRelicFrame, RunRelicId } from '@infinite-flow/core/run-relics';

export type PersistedRunSeeds = Readonly<{
  rulesVersion: 1;
  hiddenTaskSeed: number;
  infernoMapSeed?: number;
}>;

type NoPayloadCommand<Type extends string> = Readonly<{ type: Type }>;

export type GameCommand =
  | NoPayloadCommand<'game/new'>
  | NoPayloadCommand<'hub/recover'>
  | Readonly<{ type: 'hub/configure-tactical-loadout'; itemIds: readonly string[] }>
  | Readonly<{
      type: 'hub/configure-relic';
      frame: RunRelicFrame;
      seedRelicId?: RunRelicId;
    }>
  | Readonly<{
      type: 'hub/prepare-equipment-hunt';
      dungeonId: DungeonId;
      equipmentId?: EquipmentId;
    }>
  | Readonly<{
      type: 'hub/prepare-equipment-memory-hunt';
      dungeonId: DungeonId;
      equipmentId?: EquipmentId;
    }>
  | Readonly<{
      type: 'hub/activate-equipment-memory';
      equipmentId: EquipmentId;
      memoryId: EquipmentMemoryId;
    }>
  | Readonly<{ type: 'hub/buy-item'; itemId: ItemId }>
  | Readonly<{
      type: 'hub/buy-equipment';
      equipmentId: EquipmentId;
      sourceDungeonId?: DungeonId;
    }>
  | Readonly<{ type: 'hub/equip-equipment'; equipmentId: EquipmentId }>
  | Readonly<{ type: 'hub/upgrade-equipment'; equipmentId: EquipmentId }>
  | Readonly<{
      type: 'hub/attune-equipment';
      equipmentId: EquipmentId;
      attunementId: EquipmentAttunementId;
    }>
  | Readonly<{ type: 'hub/temper-equipment'; equipmentId: EquipmentId }>
  | Readonly<{ type: 'hub/buy-pet'; petId: PetId }>
  | Readonly<{ type: 'hub/upgrade-pet'; petId: PetId }>
  | Readonly<{ type: 'hub/activate-pet'; petId: PetId }>
  | Readonly<{ type: 'hub/learn-method'; methodId: MethodId }>
  | Readonly<{ type: 'hub/upgrade-method'; methodId: MethodId }>
  | Readonly<{ type: 'hub/activate-method'; methodId: MethodId }>
  | Readonly<{ type: 'hub/unlock-bloodline'; bloodlineId: BloodlineId }>
  | Readonly<{ type: 'hub/upgrade-bloodline'; bloodlineId: BloodlineId }>
  | Readonly<{ type: 'hub/activate-bloodline'; bloodlineId: BloodlineId }>
  | Readonly<{ type: 'hub/recruit-companion'; companionId: CompanionId }>
  | Readonly<{ type: 'hub/upgrade-companion'; companionId: CompanionId }>
  | Readonly<{ type: 'hub/activate-companion'; companionId: CompanionId }>
  | Readonly<{
      type: 'hub/start-equipment-commission';
      equipmentIds: readonly [EquipmentId, EquipmentId];
      targetMaterialId: ItemId;
    }>
  | NoPayloadCommand<'hub/recall-equipment-commission'>
  | Readonly<{ type: 'hub/claim-task'; taskId: string }>
  | Readonly<{
      type: 'run/enter';
      dungeonId: DungeonId;
      protocolId: RunProtocolId;
      routeContractId?: string;
      infernoTier?: number;
      seeds: PersistedRunSeeds;
    }>
  | Readonly<{ type: 'run/move'; nodeId: string }>
  | Readonly<{ type: 'run/select-node'; nodeId: string }>
  | Readonly<{ type: 'node/handle-trap'; choice: TrapChoice }>
  | Readonly<{ type: 'node/use-portal'; choice: PortalChoice }>
  | NoPayloadCommand<'node/collect-reward'>
  | Readonly<{ type: 'node/resolve-event'; eventId: string; optionId: string }>
  | Readonly<{ type: 'node/resolve-field-survey'; optionId: string }>
  | Readonly<{ type: 'node/resolve-equipment-loot'; equipmentId?: EquipmentId }>
  | Readonly<{
      type: 'node/resolve-relic-draft';
      relicId: RunRelicId;
      draftId?: string;
    }>
  | NoPayloadCommand<'node/activate-soul-recharge'>
  | Readonly<{ type: 'node/resolve-soul-recharge'; skillId: EquipmentSoulSkillId }>
  | NoPayloadCommand<'node/cancel-soul-recharge'>
  | Readonly<{
      type: 'node/use-soul-skill';
      skillId: EquipmentSoulSkillId;
      targetNodeId?: string;
      portalChoice?: PortalChoice;
      itemId?: ItemId;
    }>
  | Readonly<{ type: 'law/resolve-causal-ledger'; choice: CausalLedgerChoice }>
  | Readonly<{ type: 'law/resolve-entropy-heading'; choice: EntropyHeadingChoice }>
  | Readonly<{ type: 'law/resolve-mirror-city-phase'; phase: MirrorCityPhase }>
  | Readonly<{ type: 'law/resolve-redaction-clause'; choice: RedactionChoice }>
  | Readonly<{
      type: 'law/resolve-auction-lot';
      choice: AuctionLotChoice;
    }>
  | Readonly<{ type: 'law/resolve-genesis-splice'; gene: GenesisGene }>
  | Readonly<{
      type: 'law/resolve-broadcast-relay';
      choice: BroadcastRelayChoice;
    }>
  | Readonly<{
      type: 'law/resolve-escort-checkpoint';
      choice: EscortCheckpointChoice;
    }>
  | Readonly<{
      type: 'law/resolve-verdict';
      suspect: FalseTestimonySuspect;
    }>
  | Readonly<{
      type: 'law/select-combat-replay-route';
      route: CombatReplayRoute;
    }>
  | Readonly<{ type: 'law/select-panopticon-route'; route: PanopticonRoute }>
  | Readonly<{ type: 'combat/act'; action: CombatAction }>
  | Readonly<{ type: 'combat/capture'; petId: PetId }>
  | Readonly<{ type: 'combat/use-method-technique'; methodId?: MethodId }>
  | NoPayloadCommand<'combat/use-companion-assist'>
  | NoPayloadCommand<'combat/use-bloodline-surge'>
  | NoPayloadCommand<'run/retreat'>
  | NoPayloadCommand<'run/resolve-exit'>
  | Readonly<{ type: 'result/archive-relic'; relicId?: RunRelicId }>
  | NoPayloadCommand<'result/return-hub'>;

export type GameCommandType = GameCommand['type'];

export type GameCommandValidationError = Readonly<{
  code: 'not-serializable' | 'unknown-command' | 'invalid-payload';
  message: string;
  commandType?: string;
}>;

export type GameCommandValidation =
  | Readonly<{ ok: true; value: GameCommand }>
  | Readonly<{ ok: false; reason: GameCommandValidationError }>;

const COMMAND_TYPES: ReadonlySet<string> = new Set<GameCommandType>([
  'game/new',
  'hub/recover',
  'hub/configure-tactical-loadout',
  'hub/configure-relic',
  'hub/prepare-equipment-hunt',
  'hub/prepare-equipment-memory-hunt',
  'hub/activate-equipment-memory',
  'hub/buy-item',
  'hub/buy-equipment',
  'hub/equip-equipment',
  'hub/upgrade-equipment',
  'hub/attune-equipment',
  'hub/temper-equipment',
  'hub/buy-pet',
  'hub/upgrade-pet',
  'hub/activate-pet',
  'hub/learn-method',
  'hub/upgrade-method',
  'hub/activate-method',
  'hub/unlock-bloodline',
  'hub/upgrade-bloodline',
  'hub/activate-bloodline',
  'hub/recruit-companion',
  'hub/upgrade-companion',
  'hub/activate-companion',
  'hub/start-equipment-commission',
  'hub/recall-equipment-commission',
  'hub/claim-task',
  'run/enter',
  'run/move',
  'run/select-node',
  'node/handle-trap',
  'node/use-portal',
  'node/collect-reward',
  'node/resolve-event',
  'node/resolve-field-survey',
  'node/resolve-equipment-loot',
  'node/resolve-relic-draft',
  'node/activate-soul-recharge',
  'node/resolve-soul-recharge',
  'node/cancel-soul-recharge',
  'node/use-soul-skill',
  'law/resolve-causal-ledger',
  'law/resolve-entropy-heading',
  'law/resolve-mirror-city-phase',
  'law/resolve-redaction-clause',
  'law/resolve-auction-lot',
  'law/resolve-genesis-splice',
  'law/resolve-broadcast-relay',
  'law/resolve-escort-checkpoint',
  'law/resolve-verdict',
  'law/select-combat-replay-route',
  'law/select-panopticon-route',
  'combat/act',
  'combat/capture',
  'combat/use-method-technique',
  'combat/use-companion-assist',
  'combat/use-bloodline-surge',
  'run/retreat',
  'run/resolve-exit',
  'result/archive-relic',
  'result/return-hub'
]);

const NO_PAYLOAD_COMMAND_TYPES: ReadonlySet<GameCommandType> = new Set([
  'game/new',
  'hub/recover',
  'hub/recall-equipment-commission',
  'node/collect-reward',
  'node/activate-soul-recharge',
  'node/cancel-soul-recharge',
  'combat/use-companion-assist',
  'combat/use-bloodline-surge',
  'run/retreat',
  'run/resolve-exit',
  'result/return-hub'
]);

const COMBAT_ACTIONS: ReadonlySet<CombatAction> = new Set([
  'attack',
  'art',
  'guard',
  'weapon_skill',
  'use_healing_pill',
  'use_thunder_talisman',
  'escape'
]);
const PROTOCOL_IDS: ReadonlySet<RunProtocolId> = new Set(['standard', 'imprint', 'deep']);
const TRAP_CHOICES: ReadonlySet<TrapChoice> = new Set(['counter', 'risk', 'auto']);
const PORTAL_CHOICES: ReadonlySet<PortalChoice> = new Set(['stabilize', 'force', 'auto']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPlainJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (ancestors.has(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;

  ancestors.add(value);
  const entries = Array.isArray(value) ? value : Object.values(value);
  const valid = entries.every((entry) => isPlainJsonValue(entry, ancestors));
  ancestors.delete(value);
  return valid;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isPositiveUint32(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 0xffff_ffff;
}

function hasStringFields(command: Record<string, unknown>, ...fields: readonly string[]): boolean {
  return fields.every((field) => isString(command[field]));
}

function isCommandPayloadValid(command: Record<string, unknown>, type: GameCommandType): boolean {
  if (NO_PAYLOAD_COMMAND_TYPES.has(type)) return true;

  switch (type) {
    case 'hub/configure-tactical-loadout':
      return Array.isArray(command.itemIds) && command.itemIds.every(isString);
    case 'hub/configure-relic':
      return isString(command.frame) && isOptionalString(command.seedRelicId);
    case 'hub/prepare-equipment-hunt':
    case 'hub/prepare-equipment-memory-hunt':
      return isString(command.dungeonId) && isOptionalString(command.equipmentId);
    case 'hub/activate-equipment-memory':
      return hasStringFields(command, 'equipmentId', 'memoryId');
    case 'hub/buy-item':
      return isString(command.itemId);
    case 'hub/buy-equipment':
      return isString(command.equipmentId) && isOptionalString(command.sourceDungeonId);
    case 'hub/equip-equipment':
    case 'hub/upgrade-equipment':
    case 'hub/temper-equipment':
      return isString(command.equipmentId);
    case 'hub/attune-equipment':
      return hasStringFields(command, 'equipmentId', 'attunementId');
    case 'hub/buy-pet':
    case 'hub/upgrade-pet':
    case 'hub/activate-pet':
    case 'combat/capture':
      return isString(command.petId);
    case 'hub/learn-method':
    case 'hub/upgrade-method':
    case 'hub/activate-method':
      return isString(command.methodId);
    case 'hub/unlock-bloodline':
    case 'hub/upgrade-bloodline':
    case 'hub/activate-bloodline':
      return isString(command.bloodlineId);
    case 'hub/recruit-companion':
    case 'hub/upgrade-companion':
    case 'hub/activate-companion':
      return isString(command.companionId);
    case 'hub/start-equipment-commission':
      return Array.isArray(command.equipmentIds) && command.equipmentIds.length === 2 &&
        command.equipmentIds.every(isString) && isString(command.targetMaterialId);
    case 'hub/claim-task':
      return isString(command.taskId);
    case 'run/enter': {
      if (!isString(command.dungeonId) || !PROTOCOL_IDS.has(command.protocolId as RunProtocolId)) return false;
      if (!isOptionalString(command.routeContractId)) return false;
      if (command.infernoTier !== undefined &&
          (!Number.isSafeInteger(command.infernoTier) || (command.infernoTier as number) < 1)) return false;
      if (!isRecord(command.seeds) || command.seeds.rulesVersion !== 1 ||
          !isPositiveUint32(command.seeds.hiddenTaskSeed)) return false;
      return command.seeds.infernoMapSeed === undefined || isPositiveUint32(command.seeds.infernoMapSeed);
    }
    case 'run/move':
    case 'run/select-node':
      return isString(command.nodeId);
    case 'node/handle-trap':
      return TRAP_CHOICES.has(command.choice as TrapChoice);
    case 'node/use-portal':
      return PORTAL_CHOICES.has(command.choice as PortalChoice);
    case 'node/resolve-event':
      return hasStringFields(command, 'eventId', 'optionId');
    case 'node/resolve-field-survey':
      return isString(command.optionId);
    case 'node/resolve-equipment-loot':
      return isOptionalString(command.equipmentId);
    case 'node/resolve-relic-draft':
      return isString(command.relicId) && isOptionalString(command.draftId);
    case 'node/resolve-soul-recharge':
      return isString(command.skillId);
    case 'node/use-soul-skill':
      return isString(command.skillId) && isOptionalString(command.targetNodeId) &&
        (command.portalChoice === undefined || PORTAL_CHOICES.has(command.portalChoice as PortalChoice)) &&
        isOptionalString(command.itemId);
    case 'law/resolve-causal-ledger':
    case 'law/resolve-entropy-heading':
    case 'law/resolve-redaction-clause':
    case 'law/resolve-auction-lot':
    case 'law/resolve-broadcast-relay':
    case 'law/resolve-escort-checkpoint':
      return isString(command.choice);
    case 'law/resolve-mirror-city-phase':
      return command.phase === 'real' || command.phase === 'mirror';
    case 'law/resolve-genesis-splice':
      return isString(command.gene);
    case 'law/resolve-verdict':
      return isString(command.suspect);
    case 'law/select-combat-replay-route':
    case 'law/select-panopticon-route':
      return isString(command.route);
    case 'combat/act':
      return COMBAT_ACTIONS.has(command.action as CombatAction);
    case 'combat/use-method-technique':
      return isOptionalString(command.methodId);
    case 'result/archive-relic':
      return isOptionalString(command.relicId);
    default:
      return false;
  }
}

export function validateGameCommand(input: unknown): GameCommandValidation {
  if (!isPlainJsonValue(input) || !isRecord(input)) {
    return {
      ok: false,
      reason: {
        code: 'not-serializable',
        message: 'Game commands must be finite, acyclic plain JSON objects.'
      }
    };
  }

  const type = input.type;
  if (typeof type !== 'string' || !COMMAND_TYPES.has(type)) {
    return {
      ok: false,
      reason: {
        code: 'unknown-command',
        message: 'Unknown game command discriminant.',
        ...(typeof type === 'string' ? { commandType: type } : {})
      }
    };
  }

  if (!isCommandPayloadValid(input, type as GameCommandType)) {
    return {
      ok: false,
      reason: {
        code: 'invalid-payload',
        message: `Invalid payload for ${type}.`,
        commandType: type
      }
    };
  }

  return { ok: true, value: input as GameCommand };
}

const HUB_COMMANDS: ReadonlySet<GameCommandType> = new Set([
  'hub/recover',
  'hub/configure-tactical-loadout',
  'hub/configure-relic',
  'hub/prepare-equipment-hunt',
  'hub/prepare-equipment-memory-hunt',
  'hub/activate-equipment-memory',
  'hub/buy-item',
  'hub/buy-equipment',
  'hub/equip-equipment',
  'hub/upgrade-equipment',
  'hub/attune-equipment',
  'hub/temper-equipment',
  'hub/buy-pet',
  'hub/upgrade-pet',
  'hub/activate-pet',
  'hub/learn-method',
  'hub/upgrade-method',
  'hub/activate-method',
  'hub/unlock-bloodline',
  'hub/upgrade-bloodline',
  'hub/activate-bloodline',
  'hub/recruit-companion',
  'hub/upgrade-companion',
  'hub/activate-companion',
  'hub/start-equipment-commission',
  'hub/recall-equipment-commission',
  'hub/claim-task',
  'run/enter'
]);

const EXPLORE_COMMANDS: ReadonlySet<GameCommandType> = new Set([
  'run/move',
  'run/select-node',
  'node/handle-trap',
  'node/use-portal',
  'node/collect-reward',
  'node/resolve-event',
  'node/resolve-field-survey',
  'node/resolve-equipment-loot',
  'node/resolve-relic-draft',
  'node/activate-soul-recharge',
  'node/resolve-soul-recharge',
  'node/cancel-soul-recharge',
  'law/resolve-causal-ledger',
  'law/resolve-entropy-heading',
  'law/resolve-mirror-city-phase',
  'law/resolve-redaction-clause',
  'law/resolve-auction-lot',
  'law/resolve-genesis-splice',
  'law/resolve-broadcast-relay',
  'law/resolve-escort-checkpoint',
  'law/resolve-verdict',
  'law/select-combat-replay-route',
  'law/select-panopticon-route',
  'run/resolve-exit'
]);

const COMBAT_COMMANDS: ReadonlySet<GameCommandType> = new Set([
  'combat/act',
  'combat/capture',
  'combat/use-method-technique',
  'combat/use-companion-assist',
  'combat/use-bloodline-surge'
]);

export function getGameCommandAllowedPhases(command: GameCommand): readonly Phase[] {
  if (command.type === 'game/new') return ['hub', 'explore', 'combat', 'result'];
  if (HUB_COMMANDS.has(command.type)) return ['hub'];
  if (command.type === 'node/use-soul-skill' || command.type === 'run/retreat') {
    return ['explore', 'combat'];
  }
  if (EXPLORE_COMMANDS.has(command.type)) return ['explore'];
  if (COMBAT_COMMANDS.has(command.type)) return ['combat'];
  return ['result'];
}

export type PhaseGuardResult =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; actualPhase: Phase; allowedPhases: readonly Phase[] }>;

export function guardGameCommandPhase(state: Pick<GameState, 'phase'>, command: GameCommand): PhaseGuardResult {
  const allowedPhases = getGameCommandAllowedPhases(command);
  return allowedPhases.includes(state.phase)
    ? { allowed: true }
    : { allowed: false, actualPhase: state.phase, allowedPhases };
}
