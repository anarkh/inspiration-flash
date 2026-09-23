import type { EquipmentId, EquipmentSlot } from './game';
import type { EquipmentTemperMap } from './equipment-system';

export const EQUIPMENT_SOUL_SKILL_RULES_VERSION = 1 as const;

export type EquipmentSoulSkillId =
  | 'mist_fixed_point'
  | 'spirit_grounding'
  | 'gauntlet_breakbeat'
  | 'cloudstep_retrace'
  | 'rift_misalignment'
  | 'rift_seal';

export type EquipmentSoulSkillContext = 'trap' | 'combat' | 'portal' | 'reward';

export type EquipmentSoulSkillEffect =
  | 'trap_force_pass'
  | 'combat_cleanse'
  | 'combat_skip_intent'
  | 'trap_backstep'
  | 'portal_offset'
  | 'reward_seal_item';

export type EquipmentSoulSkillSourceEquipmentId =
  | 'mist_hood'
  | 'spirit_robe'
  | 'guardian_gauntlets'
  | 'cloudstep_boots'
  | 'rift_belt'
  | 'rift_charm';

export type EquipmentSoulSkillSourceSlot = Extract<
  EquipmentSlot,
  'head' | 'armor' | 'hands' | 'feet' | 'waist' | 'charm'
>;

type EquipmentSoulSkillContextEffect =
  | Readonly<{ context: 'trap'; effect: 'trap_force_pass' | 'trap_backstep' }>
  | Readonly<{ context: 'combat'; effect: 'combat_cleanse' | 'combat_skip_intent' }>
  | Readonly<{ context: 'portal'; effect: 'portal_offset' }>
  | Readonly<{ context: 'reward'; effect: 'reward_seal_item' }>;

export type EquipmentSoulSkillDefinition = Readonly<{
  id: EquipmentSoulSkillId;
  equipmentId: EquipmentSoulSkillSourceEquipmentId;
  sourceSlot: EquipmentSoulSkillSourceSlot;
  name: string;
  description: string;
  requiredLevel: 3;
  minimumTemperRank: 1;
}> & EquipmentSoulSkillContextEffect;

export const EQUIPMENT_SOUL_SKILL_CATALOG = Object.freeze([
  Object.freeze({
    id: 'mist_fixed_point',
    equipmentId: 'mist_hood',
    sourceSlot: 'head',
    name: '雾听定相',
    description: '遭遇陷阱时，可令本次陷阱判定直接通过。',
    context: 'trap',
    effect: 'trap_force_pass',
    requiredLevel: 3,
    minimumTemperRank: 1
  }),
  Object.freeze({
    id: 'spirit_grounding',
    equipmentId: 'spirit_robe',
    sourceSlot: 'armor',
    name: '灵纹泄地',
    description: '战斗中清除自身当前可净化的负面状态。',
    context: 'combat',
    effect: 'combat_cleanse',
    requiredLevel: 3,
    minimumTemperRank: 1
  }),
  Object.freeze({
    id: 'gauntlet_breakbeat',
    equipmentId: 'guardian_gauntlets',
    sourceSlot: 'hands',
    name: '震地断拍',
    description: '战斗中打断敌人当前意图，使该意图不执行。',
    context: 'combat',
    effect: 'combat_skip_intent',
    requiredLevel: 3,
    minimumTemperRank: 1
  }),
  Object.freeze({
    id: 'cloudstep_retrace',
    equipmentId: 'cloudstep_boots',
    sourceSlot: 'feet',
    name: '云隙回步',
    description: '遭遇陷阱时退回上一个节点，跳过本次陷阱结算。',
    context: 'trap',
    effect: 'trap_backstep',
    requiredLevel: 3,
    minimumTemperRank: 1
  }),
  Object.freeze({
    id: 'rift_misalignment',
    equipmentId: 'rift_belt',
    sourceSlot: 'waist',
    name: '错位锚定',
    description: '通过传送门时，将落点偏移到另一个合法目标。',
    context: 'portal',
    effect: 'portal_offset',
    requiredLevel: 3,
    minimumTemperRank: 1
  }),
  Object.freeze({
    id: 'rift_seal',
    equipmentId: 'rift_charm',
    sourceSlot: 'charm',
    name: '裂隙封存',
    description: '领取奖励时封存一件所选物品，使其按封存规则结算。',
    context: 'reward',
    effect: 'reward_seal_item',
    requiredLevel: 3,
    minimumTemperRank: 1
  })
] as const) satisfies readonly EquipmentSoulSkillDefinition[];

export type EquipmentSoulSkillChargeCount = 0 | 1 | 2;

export type EquipmentSoulSkillPendingRecharge = Readonly<{
  rechargeId: string;
  nodeId: string;
}>;

export type EquipmentSoulSkillRunState = Readonly<{
  rulesVersion: typeof EQUIPMENT_SOUL_SKILL_RULES_VERSION;
  frozenSkillIds: readonly EquipmentSoulSkillId[];
  readySkillIds: readonly EquipmentSoulSkillId[];
  chargesRemaining: EquipmentSoulSkillChargeCount;
  usedRechargeIds: readonly string[];
  pendingRecharge?: EquipmentSoulSkillPendingRecharge;
}>;

export type EquipmentSoulSkillAvailability = 'not_frozen' | 'spent' | 'no_charges' | 'ready';

export type EquipmentSoulSkillStatus = Readonly<{
  skillId: EquipmentSoulSkillId;
  availability: EquipmentSoulSkillAvailability;
  frozen: boolean;
  ready: boolean;
  spent: boolean;
  canConsume: boolean;
  chargesRemaining: EquipmentSoulSkillChargeCount;
}>;

const SKILL_ID_SET = new Set<string>(EQUIPMENT_SOUL_SKILL_CATALOG.map(({ id }) => id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEquipmentSoulSkillId(value: unknown): value is EquipmentSoulSkillId {
  return typeof value === 'string' && SKILL_ID_SET.has(value);
}

function normalizeSkillIds(value: unknown, fieldName: string): EquipmentSoulSkillId[] {
  if (!Array.isArray(value)) throw new TypeError(`${fieldName} must be an array.`);

  const seen = new Set<EquipmentSoulSkillId>();
  for (const entry of value) {
    if (!isEquipmentSoulSkillId(entry)) {
      throw new TypeError(`${fieldName} contains an unknown skill id: ${String(entry)}`);
    }
    if (seen.has(entry)) throw new TypeError(`${fieldName} contains a duplicate skill id: ${entry}`);
    seen.add(entry);
  }

  // Persisted snapshots are restored in catalog order so callers cannot influence activation order.
  return EQUIPMENT_SOUL_SKILL_CATALOG.map(({ id }) => id).filter((id) => seen.has(id));
}

function normalizeRechargeIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new TypeError('usedRechargeIds must be an array.');

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of value) {
    if (!isNonEmptyString(entry)) {
      throw new TypeError('usedRechargeIds must contain only non-empty strings.');
    }
    if (seen.has(entry)) throw new TypeError(`usedRechargeIds contains a duplicate id: ${entry}`);
    seen.add(entry);
    normalized.push(entry);
  }
  return normalized;
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

export function getEquipmentSoulSkillByEquipmentId(
  equipmentId: EquipmentId
): EquipmentSoulSkillDefinition | undefined {
  return EQUIPMENT_SOUL_SKILL_CATALOG.find((definition) => definition.equipmentId === equipmentId);
}

export function getActiveEquipmentSoulSkills(
  equipped: Readonly<Record<EquipmentSlot, EquipmentId>>,
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>> = {},
  temperRanks: EquipmentTemperMap = {}
): EquipmentSoulSkillDefinition[] {
  return EQUIPMENT_SOUL_SKILL_CATALOG.filter((definition) => {
    const temperRank = temperRanks[definition.equipmentId];
    return (
      equipped[definition.sourceSlot] === definition.equipmentId &&
      equipmentLevels[definition.equipmentId] === definition.requiredLevel &&
      (temperRank === 1 || temperRank === 2)
    );
  });
}

export function createEquipmentSoulSkillRunState(
  equipped: Readonly<Record<EquipmentSlot, EquipmentId>>,
  equipmentLevels: Readonly<Partial<Record<EquipmentId, number>>> = {},
  temperRanks: EquipmentTemperMap = {}
): EquipmentSoulSkillRunState {
  const frozenSkillIds = getActiveEquipmentSoulSkills(equipped, equipmentLevels, temperRanks).map(
    ({ id }) => id
  );

  return {
    rulesVersion: EQUIPMENT_SOUL_SKILL_RULES_VERSION,
    frozenSkillIds,
    readySkillIds: [...frozenSkillIds],
    chargesRemaining: Math.min(2, frozenSkillIds.length) as EquipmentSoulSkillChargeCount,
    usedRechargeIds: []
  };
}

export function normalizeEquipmentSoulSkillRunState(value: unknown): EquipmentSoulSkillRunState {
  if (!isRecord(value)) throw new TypeError('Equipment soul skill state must be an object.');
  if (value.rulesVersion !== EQUIPMENT_SOUL_SKILL_RULES_VERSION) {
    throw new TypeError(`Unsupported equipment soul skill rules version: ${String(value.rulesVersion)}`);
  }

  const frozenSkillIds = normalizeSkillIds(value.frozenSkillIds, 'frozenSkillIds');
  const readySkillIds = normalizeSkillIds(value.readySkillIds, 'readySkillIds');
  const frozenSet = new Set(frozenSkillIds);
  if (readySkillIds.some((skillId) => !frozenSet.has(skillId))) {
    throw new TypeError('readySkillIds must be a subset of frozenSkillIds.');
  }

  if (
    !Number.isInteger(value.chargesRemaining) ||
    (value.chargesRemaining as number) < 0 ||
    (value.chargesRemaining as number) > 2
  ) {
    throw new TypeError('chargesRemaining must be an integer from 0 through 2.');
  }
  const chargesRemaining = value.chargesRemaining as EquipmentSoulSkillChargeCount;
  const usedRechargeIds = normalizeRechargeIds(value.usedRechargeIds);
  const spentSkillIds = frozenSkillIds.filter((skillId) => !readySkillIds.includes(skillId));

  let pendingRecharge: EquipmentSoulSkillPendingRecharge | undefined;
  if (value.pendingRecharge !== undefined) {
    const pendingKeys = isRecord(value.pendingRecharge) ? Object.keys(value.pendingRecharge) : [];
    if (
      !isRecord(value.pendingRecharge) ||
      pendingKeys.length !== 2 ||
      pendingKeys.some((key) => key !== 'rechargeId' && key !== 'nodeId') ||
      !isNonEmptyString(value.pendingRecharge.rechargeId) ||
      !isNonEmptyString(value.pendingRecharge.nodeId)
    ) {
      throw new TypeError('pendingRecharge must contain only non-empty rechargeId and nodeId strings.');
    }
    if (usedRechargeIds.includes(value.pendingRecharge.rechargeId)) {
      throw new TypeError('pendingRecharge.rechargeId must not already be used.');
    }
    if (spentSkillIds.length === 0) {
      throw new TypeError('pendingRecharge requires at least one spent skill.');
    }
    pendingRecharge = {
      rechargeId: value.pendingRecharge.rechargeId,
      nodeId: value.pendingRecharge.nodeId
    };
  }

  return {
    rulesVersion: EQUIPMENT_SOUL_SKILL_RULES_VERSION,
    frozenSkillIds,
    readySkillIds,
    chargesRemaining,
    usedRechargeIds,
    ...(pendingRecharge === undefined ? {} : { pendingRecharge })
  };
}

export function isEquipmentSoulSkillRunState(value: unknown): value is EquipmentSoulSkillRunState {
  if (!isRecord(value)) return false;

  try {
    const normalized = normalizeEquipmentSoulSkillRunState(value);
    if (!Array.isArray(value.frozenSkillIds) || !Array.isArray(value.readySkillIds)) return false;
    if (!Array.isArray(value.usedRechargeIds)) return false;
    if (!arraysEqual(value.frozenSkillIds, normalized.frozenSkillIds)) return false;
    if (!arraysEqual(value.readySkillIds, normalized.readySkillIds)) return false;
    if (!arraysEqual(value.usedRechargeIds, normalized.usedRechargeIds)) return false;

    if (normalized.pendingRecharge === undefined) return value.pendingRecharge === undefined;
    return (
      isRecord(value.pendingRecharge) &&
      value.pendingRecharge.rechargeId === normalized.pendingRecharge.rechargeId &&
      value.pendingRecharge.nodeId === normalized.pendingRecharge.nodeId
    );
  } catch {
    return false;
  }
}

export function getEquipmentSoulSkillStatus(
  state: EquipmentSoulSkillRunState,
  skillId: EquipmentSoulSkillId
): EquipmentSoulSkillStatus {
  const frozen = state.frozenSkillIds.includes(skillId);
  const ready = frozen && state.readySkillIds.includes(skillId);
  const spent = frozen && !ready;
  const canConsume = ready && state.chargesRemaining > 0;
  const availability: EquipmentSoulSkillAvailability = !frozen
    ? 'not_frozen'
    : !ready
      ? 'spent'
      : state.chargesRemaining === 0
        ? 'no_charges'
        : 'ready';

  return {
    skillId,
    availability,
    frozen,
    ready,
    spent,
    canConsume,
    chargesRemaining: state.chargesRemaining
  };
}

export function consumeEquipmentSoulSkill(
  state: EquipmentSoulSkillRunState,
  skillId: EquipmentSoulSkillId,
  context: EquipmentSoulSkillContext
): EquipmentSoulSkillRunState {
  if (!isEquipmentSoulSkillRunState(state)) return state;
  const definition = EQUIPMENT_SOUL_SKILL_CATALOG.find(({ id }) => id === skillId);
  if (
    !definition ||
    definition.context !== context ||
    !state.frozenSkillIds.includes(skillId) ||
    !state.readySkillIds.includes(skillId) ||
    state.chargesRemaining === 0
  ) {
    return state;
  }

  return {
    rulesVersion: EQUIPMENT_SOUL_SKILL_RULES_VERSION,
    frozenSkillIds: [...state.frozenSkillIds],
    readySkillIds: state.readySkillIds.filter((readySkillId) => readySkillId !== skillId),
    chargesRemaining: (state.chargesRemaining - 1) as EquipmentSoulSkillChargeCount,
    usedRechargeIds: [...state.usedRechargeIds],
    ...(state.pendingRecharge === undefined
      ? {}
      : { pendingRecharge: { ...state.pendingRecharge } })
  };
}

export function getSpentEquipmentSoulSkills(
  state: EquipmentSoulSkillRunState
): EquipmentSoulSkillId[] {
  const readySkillIds = new Set(state.readySkillIds);
  return state.frozenSkillIds.filter((skillId) => !readySkillIds.has(skillId));
}

export function activateEquipmentSoulSkillRecharge(
  state: EquipmentSoulSkillRunState,
  rechargeId: string,
  nodeId: string
): EquipmentSoulSkillRunState {
  if (
    !isEquipmentSoulSkillRunState(state) ||
    !isNonEmptyString(rechargeId) ||
    !isNonEmptyString(nodeId) ||
    state.pendingRecharge ||
    state.usedRechargeIds.includes(rechargeId) ||
    getSpentEquipmentSoulSkills(state).length === 0
  ) {
    return state;
  }

  return {
    rulesVersion: EQUIPMENT_SOUL_SKILL_RULES_VERSION,
    frozenSkillIds: [...state.frozenSkillIds],
    readySkillIds: [...state.readySkillIds],
    chargesRemaining: state.chargesRemaining,
    usedRechargeIds: [...state.usedRechargeIds],
    pendingRecharge: { rechargeId, nodeId }
  };
}

export function resolveEquipmentSoulSkillRecharge(
  state: EquipmentSoulSkillRunState,
  skillId: EquipmentSoulSkillId
): EquipmentSoulSkillRunState {
  if (
    !isEquipmentSoulSkillRunState(state) ||
    !state.pendingRecharge ||
    !state.frozenSkillIds.includes(skillId) ||
    state.readySkillIds.includes(skillId)
  ) {
    return state;
  }

  const restoredReadyIds = new Set([...state.readySkillIds, skillId]);
  return {
    rulesVersion: EQUIPMENT_SOUL_SKILL_RULES_VERSION,
    frozenSkillIds: [...state.frozenSkillIds],
    readySkillIds: state.frozenSkillIds.filter((frozenSkillId) => restoredReadyIds.has(frozenSkillId)),
    chargesRemaining: Math.min(2, state.chargesRemaining + 1) as EquipmentSoulSkillChargeCount,
    usedRechargeIds: [...state.usedRechargeIds, state.pendingRecharge.rechargeId]
  };
}

export function cancelEquipmentSoulSkillRecharge(
  state: EquipmentSoulSkillRunState
): EquipmentSoulSkillRunState {
  if (!isEquipmentSoulSkillRunState(state) || !state.pendingRecharge) return state;

  return {
    rulesVersion: EQUIPMENT_SOUL_SKILL_RULES_VERSION,
    frozenSkillIds: [...state.frozenSkillIds],
    readySkillIds: [...state.readySkillIds],
    chargesRemaining: state.chargesRemaining,
    usedRechargeIds: [...state.usedRechargeIds]
  };
}
